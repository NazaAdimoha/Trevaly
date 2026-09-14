import type { Metadata } from 'next';

import OrdersView from '@/components/pages/dashboard/stores/orders';

export const metadata: Metadata = { title: 'Orders' };

/**
 * The page the sidebar linked to from the start — it 404'd until now.
 *
 * Membership is enforced by `[storeSlug]/layout.tsx`, like every other store
 * page, and again by the API on every request the view makes.
 */
export default async function OrdersPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  return <OrdersView storeSlug={storeSlug} />;
}
