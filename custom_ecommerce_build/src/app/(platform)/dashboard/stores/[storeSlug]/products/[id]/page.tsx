import { notFound } from 'next/navigation';

import { requireTenantMember } from '@/lib/auth';
import { tenantDb } from '@/lib/tenant-db';

import ProductDetailView from '@/components/pages/dashboard/stores/products/detail';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ storeSlug: string; id: string }>;
}) {
  const { storeSlug, id } = await params;
  const { tenant } = await requireTenantMember(storeSlug);

  const product = await tenantDb(tenant.id).product.findFirst({
    where: { id },
    include: { category: { select: { name: true } } },
  });
  if (!product) notFound();

  return <ProductDetailView storeSlug={storeSlug} product={product} />;
}
