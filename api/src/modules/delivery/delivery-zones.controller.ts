import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import type { z } from 'zod';

import {
  deliveryZoneUpdateSchema,
  type DeliveryZoneWritePayload,
  deliveryZoneWriteSchema,
} from '@core/validation/delivery-zone';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../../database/tenant-db';

@Controller('stores/:storeSlug/delivery-zones')
@StoreMember()
export class DeliveryZonesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async list(@CurrentStore() { tenant }: StoreAuth) {
    const items = await tenantDb(this.prisma, tenant.id).deliveryZone.findMany({
      orderBy: [{ position: 'asc' }, { feeKobo: 'asc' }],
    });
    return { items, total: items.length };
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(deliveryZoneWriteSchema, 'Invalid delivery zone'))
    body: DeliveryZoneWritePayload,
  ) {
    return tenantDb(this.prisma, tenant.id).deliveryZone.create({ data: body } as never);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentStore() { tenant }: StoreAuth,
    @Param('id') id: string,
    @Body(new ZodPipe(deliveryZoneUpdateSchema, 'Invalid delivery zone'))
    body: z.infer<typeof deliveryZoneUpdateSchema>,
  ) {
    try {
      return await tenantDb(this.prisma, tenant.id).deliveryZone.update({
        where: { id },
        data: body,
      });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) throw new ApiException(404, 'Zone not found');
      throw err;
    }
  }

  /** Past orders keep their fee and address; the count comes back to warn with. */
  @Delete(':id')
  @HttpCode(200)
  async remove(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string) {
    try {
      const db = tenantDb(this.prisma, tenant.id);
      const orphaned = await db.order.count({ where: { deliveryZoneId: id } });
      await db.deliveryZone.delete({ where: { id } });
      return { orphaned };
    } catch (err) {
      if (err instanceof CrossTenantAccessError) throw new ApiException(404, 'Zone not found');
      throw err;
    }
  }
}
