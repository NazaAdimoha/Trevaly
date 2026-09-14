import type { Metadata } from 'next';

import ProductFormView from '@/components/pages/dashboard/stores/products/create';

export const metadata: Metadata = { title: 'Add product' };

export default async function CreateProductPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  return <ProductFormView storeSlug={storeSlug} />;
}
