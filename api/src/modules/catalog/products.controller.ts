import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';

import { isOwnedBy } from '@core/media/folder';
import {
  emptyToNull,
  productListQuerySchema,
  productUpdateSchema,
  type ProductWritePayload,
  productWriteSchema,
  variantRejectionReason,
} from '@core/validation/product';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { isPrismaError, uniqueTarget } from '../../common/prisma-errors';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../../database/tenant-db';
import type { Prisma } from '../../generated/prisma/client';

type ProductListQuery = {
  search?: string;
  isActive?: 'true' | 'false';
  categoryId?: string;
  page: number;
  pageSize: number;
};

@Controller('stores/:storeSlug/products')
@StoreMember()
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `Product.categoryId` is a plain foreign key, so Postgres would accept
   * ANOTHER tenant's category. Resolving it through `tenantDb` makes the
   * reference tenant-safe.
   */
  private async categoryOwned(tenantId: string, categoryId: string | null | undefined) {
    if (!categoryId) return true;
    const found = await tenantDb(this.prisma, tenantId).category.findFirst({
      where: { id: categoryId },
      select: { id: true },
    });
    return Boolean(found);
  }

  @Get()
  @HttpCode(200)
  async list(
    @CurrentStore() { tenant }: StoreAuth,
    @Query(new ZodPipe(productListQuerySchema, 'Invalid query')) query: ProductListQuery,
  ) {
    const { search, isActive, categoryId, page, pageSize } = query;
    const db = tenantDb(this.prisma, tenant.id);

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
          // Once a product sells by option, `Product.stock` is meaningless.
          variants: { orderBy: { position: 'asc' } },
        },
      }),
      db.product.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(productWriteSchema, 'Invalid product')) body: ProductWritePayload,
  ) {
    if (body.imageUrls.some((publicId) => !isOwnedBy(publicId, tenant.slug))) {
      throw new ApiException(403, 'Those images do not belong to this store');
    }
    if (!(await this.categoryOwned(tenant.id, body.categoryId))) {
      throw new ApiException(403, 'That category does not belong to this store');
    }
    const rejection = variantRejectionReason(body);
    if (rejection) throw new ApiException(400, rejection);

    const { variants, ...productInput } = body;
    const data = emptyToNull(productInput, ['description', 'sku', 'categoryId', 'optionName']);

    try {
      return await tenantDb(this.prisma, tenant.id).product.create({
        data: {
          ...data,
          variants: {
            // tenantDb stamps the top-level `data` only, so nested rows set it.
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
    } catch (err) {
      if (isPrismaError(err, 'P2002')) {
        const target = uniqueTarget(err);
        throw new ApiException(
          409,
          `A product with this ${target?.includes('sku') ? 'SKU' : 'slug'} already exists`,
        );
      }
      throw err;
    }
  }

  /** findFirst: a stale bookmark reads as "not found", not an attack. */
  @Get(':id')
  @HttpCode(200)
  async get(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string) {
    const product = await tenantDb(this.prisma, tenant.id).product.findFirst({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        variants: { orderBy: { position: 'asc' } },
      },
    });
    if (!product) throw new ApiException(404, 'Product not found');
    return product;
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentStore() { tenant }: StoreAuth,
    @Param('id') id: string,
    @Body(new ZodPipe(productUpdateSchema, 'Invalid product'))
    body: Partial<ProductWritePayload>,
  ) {
    if ((body.imageUrls ?? []).some((publicId) => !isOwnedBy(publicId, tenant.slug))) {
      throw new ApiException(403, 'Those images do not belong to this store');
    }
    if (!(await this.categoryOwned(tenant.id, body.categoryId))) {
      throw new ApiException(403, 'That category does not belong to this store');
    }
    const rejection = variantRejectionReason(body);
    if (rejection) throw new ApiException(400, rejection);

    const { variants, ...productInput } = body;
    const data = emptyToNull(productInput, ['description', 'sku', 'categoryId', 'optionName']);
    const db = tenantDb(this.prisma, tenant.id);

    try {
      // Every variant id the payload touches is checked against this
      // tenant-scoped list first.
      const existing = variants
        ? await db.productVariant.findMany({ where: { productId: id }, select: { id: true } })
        : [];
      const existingIds = new Set(existing.map((v) => v.id));

      if (variants?.some((v) => v.id && !existingIds.has(v.id))) {
        throw new ApiException(409, 'One of those options no longer exists');
      }

      const keptIds = new Set(
        (variants ?? []).map((v) => v.id).filter((v): v is string => Boolean(v)),
      );
      const removedIds = [...existingIds].filter((v) => !keptIds.has(v));

      // A removed option on a real order is retired, not deleted.
      // OrderItem has no tenantId; the ids were proven this tenant's above.
      const referenced =
        removedIds.length > 0
          ? await this.prisma.orderItem.findMany({
              where: { variantId: { in: removedIds } },
              select: { variantId: true },
              distinct: ['variantId'],
            })
          : [];
      const referencedIds = new Set(referenced.map((r) => r.variantId).filter(Boolean));

      return await db.product.update({
        where: { id },
        data: {
          ...data,
          ...(variants
            ? {
                variants: {
                  deleteMany: {
                    id: { in: removedIds.filter((v) => !referencedIds.has(v)) },
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
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof CrossTenantAccessError) {
        throw new ApiException(404, 'Product not found');
      }
      if (isPrismaError(err, 'P2002')) {
        throw new ApiException(409, 'Another product already uses this slug or SKU');
      }
      throw err;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string): Promise<void> {
    try {
      await tenantDb(this.prisma, tenant.id).product.delete({ where: { id } });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        throw new ApiException(404, 'Product not found');
      }
      // OrderItem.product is Restrict: a sold product cannot be deleted.
      if (isPrismaError(err, 'P2003')) {
        throw new ApiException(
          409,
          'This product appears on existing orders and cannot be deleted. Mark it inactive instead.',
        );
      }
      throw err;
    }
  }
}
