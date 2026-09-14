import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { tenantDb } from '@/lib/tenant-db';

const zoneWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  // Free delivery is legitimate, so zero is allowed — unlike a product price.
  feeKobo: z.number().int().min(0),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

type RouteContext = { params: Promise<{ storeSlug: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const items = await tenantDb(tenant.id).deliveryZone.findMany({
      orderBy: [{ position: 'asc' }, { feeKobo: 'asc' }],
    });

    return NextResponse.json({ items, total: items.length });
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = zoneWriteSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid delivery zone', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const zone = await tenantDb(tenant.id).deliveryZone.create({
      data: parsed.data,
    } as never);

    return NextResponse.json(zone, { status: 201 });
  });
}
