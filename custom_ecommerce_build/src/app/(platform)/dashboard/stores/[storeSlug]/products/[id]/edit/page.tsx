import { notFound } from 'next/navigation';

import { requireTenantMember } from '@/lib/auth';
import { tenantDb } from '@/lib/tenant-db';

import ProductFormView from '@/components/pages/dashboard/stores/products/create';

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ storeSlug: string; id: string }>;
}) {
  const { storeSlug, id } = await params;
  const { tenant } = await requireTenantMember(storeSlug);

  const product = await tenantDb(tenant.id).product.findFirst({
    where: { id },
  });
  if (!product) notFound();

  return <ProductFormView storeSlug={storeSlug} product={product} />;
}
