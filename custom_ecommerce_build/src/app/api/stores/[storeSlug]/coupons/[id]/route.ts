import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { CrossTenantAccessError, tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

/**
 * What may change on a live coupon.
 *
 * `code`, `type` and `value` are deliberately absent. A coupon that has already
 * been used is a record of a promise made to customers, and silently changing
 * what "SAVE10" means would rewrite the terms of orders already placed under
 * it. To change the offer, deactivate this one and make another.
 */
const couponUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
  minOrderKobo: z.number().int().min(0).optional(),
});

type RouteContext = { params: Promise<{ storeSlug: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = couponUpdateSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid coupon', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const coupon = await tenantDb(tenant.id).coupon.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json(coupon);
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
      }
      throw err;
    }
  });
}

/**
 * Delete a coupon.
 *
 * Refused once it has been used: `Order.coupon` is `onDelete: SetNull`, so
 * deleting a redeemed coupon would quietly detach the discount from orders that
 * carry it and leave a total nobody can explain. Deactivation is offered
 * instead, which is what the merchant wants in every case except a typo.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    try {
      const db = tenantDb(tenant.id);
      const used = await db.order.count({ where: { couponId: id } });

      if (used > 0) {
        return NextResponse.json(
          {
            error: `This code has been used on ${used} order${used === 1 ? '' : 's'}. Turn it off instead of deleting it.`,
            used,
          },
          { status: 409 },
        );
      }

      await db.coupon.delete({ where: { id } });
      return NextResponse.json({ deleted: true });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2025'
      ) {
        return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
      }
      throw err;
    }
  });
}
