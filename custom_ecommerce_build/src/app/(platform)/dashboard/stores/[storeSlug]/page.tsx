import type { Metadata } from 'next';

import { requireTenantMember } from '@/lib/auth';
import { getStoreOverview } from '@/lib/stores/overview';

import StoreOverviewView from '@/components/pages/dashboard/stores/overview';

export const metadata: Metadata = { title: 'Overview' };

export default async function StoreOverviewPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { tenant } = await requireTenantMember(storeSlug);
  // Same function the mobile app's /overview endpoint calls, so the phone and
  // the browser cannot disagree about how much the store has taken.
  const { stats } = await getStoreOverview(tenant);

  return (
    <StoreOverviewView
      storeSlug={storeSlug}
      tenant={{ name: tenant.name, slug: tenant.slug, status: tenant.status }}
      stats={stats}
    />
  );
}
