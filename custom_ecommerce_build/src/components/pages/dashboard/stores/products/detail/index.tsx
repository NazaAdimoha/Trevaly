'use client';

// Client for the same reason as `PageHeader`: `ButtonLink` is a client
// component, so `leftIcon={Pencil}` would otherwise be serialized across the
// boundary. The view itself is presentational — the page above it does the
// authorization and the data fetch.
import { Pencil } from 'lucide-react';

import { formatCurrency, formatDate } from '@/lib/utils';

import ButtonLink from '@/components/links/ButtonLink';
import PageHeader from '@/components/ui/pageHeader';
import { SummaryCard } from '@/components/ui/summary-card';

import ROUTES from '@/constant/routes';

type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string } | null;
};

export default function ProductDetailView({
  storeSlug,
  product,
}: {
  storeSlug: string;
  product: ProductDetail;
}) {
  return (
    <div className='flex flex-col space-y-3.5'>
      <div className='flex items-center justify-between'>
        <PageHeader
          title={product.name}
          description={product.sku ?? undefined}
          url={ROUTES.store.products.base(storeSlug)}
        />
        <ButtonLink
          href={ROUTES.store.products.edit(storeSlug, product.id)}
          leftIcon={Pencil}
        >
          Edit
        </ButtonLink>
      </div>

      <SummaryCard
        title='Product details'
        items={[
          { label: 'Price', value: formatCurrency(product.priceKobo) },
          { label: 'Stock', value: String(product.stock) },
          { label: 'Status', value: product.isActive ? 'Active' : 'Inactive' },
          { label: 'URL slug', value: `/products/${product.slug}` },
          { label: 'Category', value: product.category?.name ?? '—' },
          { label: 'Added', value: formatDate(product.createdAt) },
          { label: 'Last updated', value: formatDate(product.updatedAt) },
        ]}
      />

      {product.description ? (
        <div className='rounded-lg bg-white p-4'>
          <p className='mb-2 text-sm font-medium text-gray-500'>Description</p>
          <p className='text-sm whitespace-pre-wrap'>{product.description}</p>
        </div>
      ) : null}
    </div>
  );
}
