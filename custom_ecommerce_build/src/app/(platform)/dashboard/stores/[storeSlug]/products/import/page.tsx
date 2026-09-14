import type { Metadata } from 'next';

import ProductImportView from '@/components/pages/dashboard/stores/products/import';

export const metadata: Metadata = { title: 'Import products' };

export default async function ProductImportPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  return <ProductImportView storeSlug={storeSlug} />;
}
