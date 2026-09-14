import type { Metadata } from 'next';

import ProductsView from '@/components/pages/dashboard/stores/products';

export const metadata: Metadata = { title: 'Products' };

export default async function ProductsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  return <ProductsView storeSlug={storeSlug} />;
}
