import type { Metadata } from 'next';

import { requireTenantMember } from '@/lib/auth';

import DeliveryZonesView from '@/components/pages/dashboard/stores/delivery-zones';

export const metadata: Metadata = { title: 'Delivery areas' };

export default async function DeliveryZonesPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  // Membership is checked here as well as in the API: a page that renders
  // before its first fetch would otherwise flash a store's chrome at someone
  // with no access to it.
  await requireTenantMember(storeSlug);

  return <DeliveryZonesView storeSlug={storeSlug} />;
}
