import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { apiGetOrNull } from '@/lib/server-api';

import OrderConfirmationView from '@/components/pages/storefront/order-confirmation';

import { resolveStorefrontTenant, storefrontApiPath } from '@/app/sites/_tenant';

export const metadata: Metadata = {
  title: 'Order confirmation',
  robots: { index: false },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ tenant: string; reference: string }>;
}) {
  const { tenant: tenantSlug, reference } = await params;
  const tenant = await resolveStorefrontTenant(tenantSlug);
  if (!tenant) notFound();

  // Scoped by the API: a reference from another store does not resolve here
  // even though paymentReference is globally unique. The email arrives already
  // masked — the full address never leaves the API for this page.
  const order = await apiGetOrNull<{
    orderNumber: number;
    status: string;
    totalKobo: number;
    maskedEmail: string;
    paidAfterCancellation: boolean;
  }>(storefrontApiPath(tenantSlug, `/orders/${encodeURIComponent(reference)}`));

  return <OrderConfirmationView reference={reference} order={order} />;
}
