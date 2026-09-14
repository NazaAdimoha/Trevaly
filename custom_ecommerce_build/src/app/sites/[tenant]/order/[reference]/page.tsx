import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { tenantDb } from '@/lib/tenant-db';

import OrderConfirmationView from '@/components/pages/storefront/order-confirmation';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

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

  // Scoped read: a reference from another store must not resolve here even
  // though paymentReference is globally unique.
  const order = await tenantDb(tenant.id).order.findFirst({
    where: { paymentReference: reference },
    select: {
      orderNumber: true,
      status: true,
      totalKobo: true,
      customerEmail: true,
    },
  });

  return <OrderConfirmationView reference={reference} order={order} />;
}
