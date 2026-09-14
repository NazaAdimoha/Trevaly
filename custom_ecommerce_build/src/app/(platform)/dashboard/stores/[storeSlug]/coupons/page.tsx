import type { Metadata } from 'next';

import { requireTenantMember } from '@/lib/auth';

import CouponsView from '@/components/pages/dashboard/stores/coupons';

export const metadata: Metadata = { title: 'Coupon codes' };

export default async function CouponsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  await requireTenantMember(storeSlug);

  return <CouponsView storeSlug={storeSlug} />;
}
