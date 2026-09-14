import { type NextRequest, NextResponse } from 'next/server';

import { couponWriteSchema } from '@core/validation/coupon';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ storeSlug: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const items = await tenantDb(tenant.id).coupon.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ items, total: items.length });
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = couponWriteSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid coupon', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { expiresAt, ...rest } = parsed.data;

    try {
      const coupon = await tenantDb(tenant.id).coupon.create({
        data: { ...rest, expiresAt: expiresAt ? new Date(expiresAt) : null },
      } as never);
      return NextResponse.json(coupon, { status: 201 });
    } catch (err) {
      // Codes are unique per tenant, so a clash only means this store already
      // uses it — another store running the same code is fine.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'This store already has a coupon with that code' },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}
