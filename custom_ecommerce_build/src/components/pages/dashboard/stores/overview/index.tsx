import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

import { formatCurrency } from '@/lib/utils';

import PageHeader from '@/components/ui/pageHeader';

import ROUTES from '@/constant/routes';
import type { TenantStatus } from '@core/enums';

type Stats = {
  productCount: number;
  activeProducts: number;
  paidOrders: number;
  pendingOrders: number;
  revenueKobo: number;
  needsAttention: number;
};

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-lg bg-white p-4'>
      <p className='text-sm text-gray-500'>{label}</p>
      <p className='mt-1 text-2xl font-semibold'>{value}</p>
    </div>
  );
}

export default function StoreOverviewView({
  storeSlug,
  tenant,
  stats,
}: {
  storeSlug: string;
  tenant: { name: string; slug: string; status: TenantStatus };
  stats: Stats;
}) {
  return (
    <div className='flex flex-col space-y-3.5'>
      <PageHeader
        title={tenant.name}
        description={`${tenant.slug} · ${tenant.status.toLowerCase()}`}
      />

      {stats.needsAttention > 0 ? (
        // Orders where money moved and the owner must decide: paid but stock
        // ran out, or paid after the order was cancelled. Never buried.
        <Link
          href={`${ROUTES.store.orders.base(storeSlug)}?needsAttention=true`}
          className='flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900'
        >
          <AlertTriangle className='size-4 shrink-0' />
          {stats.needsAttention} paid{' '}
          {stats.needsAttention === 1 ? 'order needs' : 'orders need'} a
          decision — out of stock, or paid after being cancelled.
        </Link>
      ) : null}

      <div className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        <StatTile label='Revenue' value={formatCurrency(stats.revenueKobo)} />
        <StatTile label='Paid orders' value={String(stats.paidOrders)} />
        <StatTile
          label='Awaiting payment'
          value={String(stats.pendingOrders)}
        />
        <StatTile
          label='Products'
          value={`${stats.activeProducts} / ${stats.productCount}`}
        />
      </div>
    </div>
  );
}
