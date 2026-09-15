import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { nextStatuses } from '@core/orders';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { CrossTenantAccessError, tenantDb } from '@/lib/tenant-db';

import { OrderStatus } from '@/generated/prisma/client';

/**
 * Order status transitions available to a store owner.
 *
 * `PAID` is deliberately absent: an order becomes PAID only through
 * `verifyAndFulfillOrder()` after the gateway confirms the money moved. Letting
 * an owner set it by hand would make the admin a way to fake payment, and would
 * bypass the stock decrement that fulfillment performs.
 */

const orderUpdateSchema = z.object({
  status: z.enum(OrderStatus).optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  hasStockIssue: z.boolean().optional(),
  // `false` only. The flag is raised by the payment path when real money lands
  // on a cancelled order; a merchant resolves it, but setting it by hand would
  // assert a payment that never happened.
  paidAfterCancellation: z.literal(false).optional(),
});

type RouteContext = { params: Promise<{ storeSlug: string; id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const order = await tenantDb(tenant.id).order.findFirst({
      where: { id },
      include: { items: true, deliveryZone: true, coupon: true },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);
    const db = tenantDb(tenant.id);

    const parsed = orderUpdateSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid update', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const existing = await db.order.findFirst({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const { status } = parsed.data;
    if (status && status !== existing.status) {
      const allowed = nextStatuses(existing.status);
      if (!allowed.includes(status)) {
        return NextResponse.json(
          {
            error: `Cannot move an order from ${existing.status} to ${status}`,
            allowed,
          },
          { status: 409 },
        );
      }
    }

    try {
      const order = await db.order.update({ where: { id }, data: parsed.data });
      return NextResponse.json(order);
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
      throw err;
    }
  });
}
