import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { apiGet } from '@/lib/server-api';

import CheckoutView from '@/components/pages/storefront/checkout';

import { resolveStorefrontTenant, storefrontApiPath } from '@/app/sites/_tenant';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  const { items: zones } = await apiGet<{
    items: Array<{ id: string; name: string; feeKobo: number }>;
  }>(storefrontApiPath(tenantSlug, '/delivery-zones'));

  return <CheckoutView zones={zones} storeAddress={tenant.storeAddress} />;
}
