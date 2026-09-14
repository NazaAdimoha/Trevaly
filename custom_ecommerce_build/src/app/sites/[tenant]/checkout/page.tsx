import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tenantDb } from '@/lib/tenant-db';

import CheckoutView from '@/components/pages/storefront/checkout';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  const zones = await tenantDb(tenant.id).deliveryZone.findMany({
    where: { isActive: true },
    orderBy: [{ position: 'asc' }, { feeKobo: 'asc' }],
    select: { id: true, name: true, feeKobo: true },
  });

  return <CheckoutView zones={zones} />;
}
