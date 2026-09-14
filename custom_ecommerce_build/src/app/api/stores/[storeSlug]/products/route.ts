import { type NextRequest, NextResponse } from 'next/server';

import { isOwnedBy } from '@core/media/folder';
import {
  emptyToNull,
  productListQuerySchema,
  productWriteSchema,
  variantRejectionReason,
} from '@core/validation/product';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ storeSlug: string }> };

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

export async function GET(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = productListQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { search, isActive, categoryId, page, pageSize } = parsed.data;
    const db = tenantDb(tenant.id);

    // tenantId is injected by the wrapper — deliberately absent here.
    const where: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(isActive ? { isActive: isActive === 'true' } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    const [items, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: { select: { id: true, name: true } },
          // Needed by every client that renders availability or price: once a
          // product sells by option, `Product.stock` is meaningless and the
          // truth is per variant. Without this the mobile app showed a fully
          // stocked product as "Out" because it only saw the parent row.
          variants: { orderBy: { position: 'asc' } },
        },
      }),
      db.product.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = productWriteSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid product', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const foreign = parsed.data.imageUrls.filter(
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

    try {
      const product = await tenantDb(tenant.id).product.create({
        data: {
          ...data,
          variants: {
            // `tenantId` is set explicitly: the tenantDb extension injects it
            // into the top-level `data` only, so a nested create would fail the
            // required column — and silently scoping it wrong is the one thing
            // that must not happen here.
            create: variants.map((variant, index) => ({
              tenantId: tenant.id,
              value: variant.value,
              sku: variant.sku || null,
              priceKobo: variant.priceKobo ?? null,
              stock: variant.stock,
              isActive: variant.isActive,
              position: index,
            })),
          },
        },
        include: { variants: true },
      } as never);
      return NextResponse.json(product, { status: 201 });
    } catch (err) {
      // Slugs and SKUs are unique per tenant, so a clash is a user error with a
      // specific fix — not a 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const target = (err.meta?.target as string[] | undefined)?.join(', ');
        return NextResponse.json(
          {
            error: `A product with this ${target?.includes('sku') ? 'SKU' : 'slug'} already exists`,
          },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}
