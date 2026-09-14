import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { CrossTenantAccessError, tenantDb } from '@/lib/tenant-db';

/** Every field optional — a PATCH must not require echoing back the rest. */
const zoneUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  feeKobo: z.number().int().min(0).optional(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ storeSlug: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = zoneUpdateSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid delivery zone', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const zone = await tenantDb(tenant.id).deliveryZone.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json(zone);
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
      }
      throw err;
    }
  });
}

/**
 * Delete a zone.
 *
 * `Order.deliveryZone` is `onDelete: SetNull`, so past orders keep their fee
 * and address and simply lose the link. Deactivating is usually what a merchant
 * actually wants — it stops the zone being offered at checkout without touching
 * history — so the count of affected orders comes back for the UI to warn with.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    try {
      const db = tenantDb(tenant.id);
      const orphaned = await db.order.count({ where: { deliveryZoneId: id } });
      await db.deliveryZone.delete({ where: { id } });
      return NextResponse.json({ orphaned });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
      }
      throw err;
    }
  });
}
