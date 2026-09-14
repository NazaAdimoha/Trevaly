import type { Metadata } from 'next';

import OrderDetailView from '@/components/pages/dashboard/stores/orders/detail';

export const metadata: Metadata = { title: 'Order' };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string; id: string }>;
}) {
  const { storeSlug, id } = await params;
  return <OrderDetailView storeSlug={storeSlug} orderId={id} />;
}
