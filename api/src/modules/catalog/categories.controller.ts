import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';

import {
  categoryUpdateSchema,
  type CategoryWritePayload,
  categoryWriteSchema,
} from '@core/validation/category';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { isPrismaError } from '../../common/prisma-errors';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../../database/tenant-db';

@Controller('stores/:storeSlug/categories')
@StoreMember()
export class CategoriesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async list(@CurrentStore() { tenant }: StoreAuth) {
    const items = await tenantDb(this.prisma, tenant.id).category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });
    return { items };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(categoryWriteSchema, 'Invalid category')) body: CategoryWritePayload,
  ) {
    try {
      return await tenantDb(this.prisma, tenant.id).category.create({ data: body } as never);
    } catch (err) {
      // Slugs are unique per tenant: a clash is a user error, not a 500.
      if (isPrismaError(err, 'P2002')) {
        throw new ApiException(409, 'A category with this name already exists');
      }
      throw err;
    }
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentStore() { tenant }: StoreAuth,
    @Param('id') id: string,
    @Body(new ZodPipe(categoryUpdateSchema, 'Invalid category'))
    body: Partial<CategoryWritePayload>,
  ) {
    try {
      return await tenantDb(this.prisma, tenant.id).category.update({ where: { id }, data: body });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        throw new ApiException(404, 'Category not found');
      }
      if (isPrismaError(err, 'P2002')) {
        throw new ApiException(409, 'Another category already uses this name');
      }
      throw err;
    }
  }

  /**
   * `Product.category` is SetNull, so products are un-filed, not deleted. The
   * count comes back for the UI to confirm with.
   */
  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string) {
    try {
      const db = tenantDb(this.prisma, tenant.id);
      const orphaned = await db.product.count({ where: { categoryId: id } });
      await db.category.delete({ where: { id } });
      return { orphaned };
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        throw new ApiException(404, 'Category not found');
      }
      throw err;
    }
  }
}
