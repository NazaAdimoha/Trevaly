import { Body, Controller, Get, HttpCode, Param, Patch, Query } from '@nestjs/common';

import { nextStatuses } from '@core/orders';
import {
  orderListQuerySchema,
  type OrderUpdatePayload,
  orderUpdateSchema,
} from '@core/validation/order';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { ZodPipe } from '../../common/zod.pipe';
import { PrismaService } from '../../database/prisma.service';
import { CrossTenantAccessError, tenantDb } from '../../database/tenant-db';
import type { OrderStatus, Prisma } from '../../generated/prisma/client';

/**
 * Whether a search term can be an order number.
 *
 * Web tested `Number.isInteger` alone, so searching a phone number
 * ("08031234567" → 8,031,234,567) put a value beyond Postgres `integer` into
 * the query and the whole search failed with a 500 — found by the parity suite.
 */
function isOrderNumber(search: string): boolean {
  const n = Number(search);
  return Number.isInteger(n) && n >= 1 && n <= 2_147_483_647;
}

type OrderListQuery = {
  search?: string;
  status?: OrderStatus;
  needsAttention?: 'true' | 'false';
  page: number;
  pageSize: number;
};

@Controller('stores/:storeSlug/orders')
@StoreMember()
export class OrdersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(200)
  async list(
    @CurrentStore() { tenant }: StoreAuth,
    @Query(new ZodPipe(orderListQuerySchema, 'Invalid query')) query: OrderListQuery,
  ) {
    const { search, status, needsAttention, page, pageSize } = query;
    const db = tenantDb(this.prisma, tenant.id);

    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      // Money has moved and the store must decide something.
      ...(needsAttention === 'true'
        ? { OR: [{ hasStockIssue: true }, { paidAfterCancellation: true }] }
        : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerEmail: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search } },
              // The order number is what a customer quotes on the phone.
              ...(isOrderNumber(search) ? [{ orderNumber: Number(search) }] : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { select: { id: true, quantity: true, productName: true } },
          deliveryZone: { select: { name: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return { items, total, page, pageSize, pageCount: Math.ceil(total / pageSize) };
  }

  @Get(':id')
  @HttpCode(200)
  async get(@CurrentStore() { tenant }: StoreAuth, @Param('id') id: string) {
    const order = await tenantDb(this.prisma, tenant.id).order.findFirst({
      where: { id },
      include: { items: true, deliveryZone: true, coupon: true },
    });
    if (!order) throw new ApiException(404, 'Order not found');
    return order;
  }

  /**
   * `PAID` is unreachable here: an order becomes PAID only through the payment
   * path, which also takes the stock.
   */
  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentStore() { tenant }: StoreAuth,
    @Param('id') id: string,
    @Body(new ZodPipe(orderUpdateSchema, 'Invalid update')) body: OrderUpdatePayload,
  ) {
    const db = tenantDb(this.prisma, tenant.id);

    const existing = await db.order.findFirst({ where: { id } });
    if (!existing) throw new ApiException(404, 'Order not found');

    const { status } = body;
    if (status && status !== existing.status) {
      const allowed = nextStatuses(existing.status);
      if (!allowed.includes(status)) {
        throw new ApiException(409, `Cannot move an order from ${existing.status} to ${status}`, {
          allowed,
        });
      }
    }

    try {
      return await db.order.update({ where: { id }, data: body });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) throw new ApiException(404, 'Order not found');
      throw err;
    }
  }
}
