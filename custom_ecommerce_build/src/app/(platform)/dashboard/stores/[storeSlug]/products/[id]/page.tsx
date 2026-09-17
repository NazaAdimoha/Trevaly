import { notFound } from 'next/navigation';

import { requireTenantMember } from '@/lib/auth';
import { apiGetOrNull } from '@/lib/server-api';

import ProductDetailView from '@/components/pages/dashboard/stores/products/detail';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string; id: string }>;
}) {
  const { storeSlug, id } = await params;
  await requireTenantMember(storeSlug);

  // Includes the category and every variant. The edit form used to be
  // handed the bare product row, so a product's options never reached it.
  const product = await apiGetOrNull<Parameters<typeof ProductDetailView>[0]['product']>(
    `/stores/${encodeURIComponent(storeSlug)}/products/${encodeURIComponent(id)}`,
    { signedIn: true },
  );
  if (!product) notFound();

  return <ProductDetailView storeSlug={storeSlug} product={product} />;
}
