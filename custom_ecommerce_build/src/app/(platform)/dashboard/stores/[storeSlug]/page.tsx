import type { Metadata } from 'next';

import type { StoreOverviewResponse } from '@core/api/contracts';

import { requireTenantMember } from '@/lib/auth';
import { apiGet } from '@/lib/server-api';

import StoreOverviewView from '@/components/pages/dashboard/stores/overview';

export const metadata: Metadata = { title: 'Overview' };

export default async function StoreOverviewPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { tenant } = await requireTenantMember(storeSlug);
  // The same endpoint the mobile app calls, so the phone and the browser cannot
  // disagree about how much the store has taken.
  const { stats } = await apiGet<StoreOverviewResponse>(
    `/stores/${encodeURIComponent(storeSlug)}/overview?period=all`,
    { signedIn: true },
  );

  return (
    <StoreOverviewView
      storeSlug={storeSlug}
      tenant={{ name: tenant.name, slug: tenant.slug, status: tenant.status }}
      stats={stats}
    />
  );
}
