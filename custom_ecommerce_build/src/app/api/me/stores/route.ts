import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import type { MyStoresResponse } from '@core/api/contracts';
import { cloudinaryUrl } from '@core/media/folder';

import { handleApiRoute } from '@/lib/auth-api';
import { tenantOrigin } from '@/lib/domains/canonical';
// eslint-disable-next-line no-restricted-imports -- membership lookup is the boundary where tenant scoping begins; there is no tenant yet to scope to
import { prisma } from '@/lib/prisma';

/**
 * The stores this user may act for.
 *
 * The mobile app cannot assume one store — a merchant may own two, and platform
 * staff none. Membership is read from `TenantUser`, the same table
 * `requireTenantMember` checks, so the app can never be shown a store the API
 * would then refuse.
 */
export async function GET() {
  return handleApiRoute(async () => {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

    const memberships = await prisma.tenantUser.findMany({
      where: { clerkUserId: userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    const body: MyStoresResponse = {
      items: memberships.map(({ tenant, role }) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        theme: tenant.theme,
        role,
        logoUrl: cloudinaryUrl(cloudName, tenant.logoPublicId, {
          width: 256,
          height: 256,
          crop: 'fill',
        }),
        currency: tenant.currency,
        storefrontUrl: tenantOrigin(tenant),
      })),
    };

    return NextResponse.json(body);
  });
}
