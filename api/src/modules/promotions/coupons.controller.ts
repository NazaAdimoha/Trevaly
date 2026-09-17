import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';

import {
  couponUpdateSchema,
  type CouponWritePayload,
  couponWriteSchema,
} from '@core/validation/coupon';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { isPrismaError } from '../../common/prisma-errors';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../../database/tenant-db';

@Controller('stores/:storeSlug/coupons')
@StoreMember()
export class CouponsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async list(@CurrentStore() { tenant }: StoreAuth) {
    const items = await tenantDb(this.prisma, tenant.id).coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { items, total: items.length };
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(couponWriteSchema, 'Invalid coupon')) body: CouponWritePayload,
  ) {
    const { expiresAt, ...rest } = body;
    try {
      return await tenantDb(this.prisma, tenant.id).coupon.create({
        data: { ...rest, expiresAt: expiresAt ? new Date(expiresAt) : null },
      } as never);
    } catch (err) {
      // Codes are unique per tenant; another store using the same code is fine.
      if (isPrismaError(err, 'P2002')) {
        throw new ApiException(409, 'This store already has a coupon with that code');
      }
      throw err;
    }
  }

  /** `code`, `type` and `value` cannot change on a live coupon. */
  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentStore() { tenant }: StoreAuth,
    @Param('id') id: string,
    @Body(new ZodPipe(couponUpdateSchema, 'Invalid coupon'))
    body: z.infer<typeof couponUpdateSchema>,
  ) {
    try {
      return await tenantDb(this.prisma, tenant.id).coupon.update({ where: { id }, data: body });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) throw new ApiException(404, 'Coupon not found');
      throw err;
    }
  }

  /**
   * Refused once used: deleting a redeemed coupon would detach the discount
   * from orders that carry it.
   */
  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string) {
    try {
      const db = tenantDb(this.prisma, tenant.id);
      const used = await db.order.count({ where: { couponId: id } });
      if (used > 0) {
        throw new ApiException(
          409,
          `This code has been used on ${used} order${used === 1 ? '' : 's'}. Turn it off instead of deleting it.`,
          { used },
        );
      }
      await db.coupon.delete({ where: { id } });
      return { deleted: true };
    } catch (err) {
      if (err instanceof ApiException) throw err;
      if (err instanceof CrossTenantAccessError || isPrismaError(err, 'P2025')) {
        throw new ApiException(404, 'Coupon not found');
      }
      throw err;
    }
  }
}
