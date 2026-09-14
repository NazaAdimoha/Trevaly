import type { Metadata } from 'next';

import { requirePlatformAdmin } from '@/lib/auth';
// eslint-disable-next-line no-restricted-imports -- platform-scoped view: spans every tenant by definition
import { prisma } from '@/lib/prisma';

import PlatformTenantsView from '@/components/pages/dashboard/platform';

export const metadata: Metadata = {
  title: 'Tenants',
  robots: { index: false },
};

/**
 * Platform operator's estate view.
 *
 * `requirePlatformAdmin()` runs here rather than in the client component: this
 * is the only screen in the app that reads across tenant boundaries, so the
 * authorization has to sit on the server, above the data.
 */
export default async function PlatformTenantsPage() {
  await requirePlatformAdmin();

  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      customDomain: true,
      paystackSubaccountCode: true,
      platformFeePercent: true,
      createdAt: true,
      _count: { select: { products: true, orders: true } },
    },
  });

  return (
    <PlatformTenantsView
      tenants={tenants.map((tenant) => ({
        ...tenant,
        // Decimal and Date do not survive the server/client boundary.
        platformFeePercent: tenant.platformFeePercent.toString(),
        createdAt: tenant.createdAt.toISOString(),
      }))}
    />
  );
}
