import { type NextRequest, NextResponse } from 'next/server';

import { isOwnedBy } from '@core/media/folder';
import {
  emptyToNull,
  productUpdateSchema,
  variantRejectionReason,
} from '@core/validation/product';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
// eslint-disable-next-line no-restricted-imports -- OrderItem carries no tenantId (it is reached through Order); the only read below is by variant ids already proven to belong to this tenant's product
import { prisma } from '@/lib/prisma';
import { CrossTenantAccessError, tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ storeSlug: string; id: string }> };

/**
 * A category a product may be filed under.
 *
 * `Product.categoryId` is a plain foreign key, so Postgres will happily accept
 * ANOTHER tenant's category id — the constraint knows about categories, not
 * about tenancy. Resolving it through `tenantDb` is what makes the reference
 * tenant-safe, and it is the same class of check `isOwnedBy` performs for
 * Cloudinary public IDs.
 */
async function assertCategoryOwned(
  tenantId: string,
  categoryId: string | null | undefined,
): Promise<boolean> {
  if (!categoryId) return true;
  const found = await tenantDb(tenantId).category.findFirst({
    where: { id: categoryId },
    select: { id: true },
  });
  return Boolean(found);
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    // findFirst, not findUnique: a miss should read as "not found" rather than
    // raise a cross-tenant error, since a stale bookmark is not an attack.
    const product = await tenantDb(tenant.id).product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        variants: { orderBy: { position: 'asc' } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }
    return NextResponse.json(product);
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = productUpdateSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid product', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // `productUpdateSchema` is partial, so imageUrls may be absent entirely —
    // only vet it when the caller is actually setting it.
    const foreign = (parsed.data.imageUrls ?? []).filter(
      (publicId) => !isOwnedBy(publicId, storeSlug),
    );
    if (foreign.length > 0) {
      return NextResponse.json(
        { error: 'Those images do not belong to this store' },
        { status: 403 },
      );
    }

    if (!(await assertCategoryOwned(tenant.id, parsed.data.categoryId))) {
      return NextResponse.json(
        { error: 'That category does not belong to this store' },
        { status: 403 },
      );
    }

    const rejection = variantRejectionReason(parsed.data);
    if (rejection) {
      return NextResponse.json({ error: rejection }, { status: 400 });
    }

    const { variants, ...productInput } = parsed.data;
    const data = emptyToNull(productInput, [
      'description',
      'sku',
      'categoryId',
      'optionName',
    ]);

    const db = tenantDb(tenant.id);

    try {
      // Read the existing variants through the tenant-scoped client first. Every
      // id the payload may touch is checked against this list, so a caller
      // cannot reach another product's — let alone another tenant's — variant
      // by putting its id in the request.
      const existing = variants
        ? await db.productVariant.findMany({
            where: { productId: id },
            select: { id: true },
          })
        : [];
      const existingIds = new Set(existing.map((v) => v.id));

      if (variants?.some((v) => v.id && !existingIds.has(v.id))) {
        return NextResponse.json(
          { error: 'One of those options no longer exists' },
          { status: 409 },
        );
      }

      const keptIds = new Set(
        (variants ?? [])
          .map((v) => v.id)
          .filter((v): v is string => Boolean(v)),
      );
      const removedIds = [...existingIds].filter((v) => !keptIds.has(v));

      // A removed option that appears on a real order is retired, not deleted:
      // OrderItem.variant is Restrict, and a receipt must keep resolving. One
      // with no history is deleted outright, so re-adding the same value later
      // does not collide with @@unique([productId, value]).
      const referenced =
        removedIds.length > 0
          ? await prisma.orderItem.findMany({
              where: { variantId: { in: removedIds } },
              select: { variantId: true },
              distinct: ['variantId'],
            })
          : [];
      const referencedIds = new Set(
        referenced.map((r) => r.variantId).filter(Boolean),
      );

      const product = await db.product.update({
        where: { id },
        data: {
          ...data,
          ...(variants
            ? {
                variants: {
                  deleteMany: {
                    id: {
                      in: removedIds.filter((v) => !referencedIds.has(v)),
                    },
                  },
                  updateMany: [
                    ...removedIds
                      .filter((v) => referencedIds.has(v))
                      .map((variantId) => ({
                        where: { id: variantId },
                        data: { isActive: false },
                      })),
                    ...variants
                      .filter((v) => v.id)
                      .map((variant, index) => ({
                        where: { id: variant.id as string },
                        data: {
                          value: variant.value,
                          sku: variant.sku || null,
                          priceKobo: variant.priceKobo ?? null,
                          stock: variant.stock,
                          isActive: variant.isActive,
                          position: index,
                        },
                      })),
                  ],
                  create: variants
                    .map((variant, index) => ({ variant, index }))
                    .filter(({ variant }) => !variant.id)
                    .map(({ variant, index }) => ({
                      tenantId: tenant.id,
                      value: variant.value,
                      sku: variant.sku || null,
                      priceKobo: variant.priceKobo ?? null,
                      stock: variant.stock,
                      isActive: variant.isActive,
                      position: index,
                    })),
                },
              }
            : {}),
        },
        include: { variants: { orderBy: { position: 'asc' } } },
      });
      return NextResponse.json(product);
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 },
        );
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'Another product already uses this slug or SKU' },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    try {
      await tenantDb(tenant.id).product.delete({ where: { id } });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 },
        );
      }
      // OrderItem.product is onDelete: Restrict — deleting a product that has
      // been sold would rewrite order history. Deactivate instead.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2003'
      ) {
        return NextResponse.json(
          {
            error:
              'This product appears on existing orders and cannot be deleted. Mark it inactive instead.',
          },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}
