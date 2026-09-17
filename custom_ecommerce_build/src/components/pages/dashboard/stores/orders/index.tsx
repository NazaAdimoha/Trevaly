'use client';

import { AlertTriangle, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';

import type { OrderStatus } from '@core/enums';

import { apiFetcher } from '@/lib/api';
import { cn, DATE_FORMATS, formatCurrency, formatDate } from '@/lib/utils';
import { useFilters } from '@/hooks/use-filters';

import { FilterSelect } from '@/components/fields/FilterSelect';
import { FilterPanel } from '@/components/ui/filter-panel';
import PageHeader from '@/components/ui/pageHeader';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import { type IColumn, TableFactory } from '@/components/ui/table-factory';

import ROUTES from '@/constant/routes';

import { ORDER_STATUS_BADGE, ORDER_STATUS_OPTIONS } from './constants';

type OrderRow = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string;
  customerPhone: string;
  totalKobo: number;
  createdAt: string;
  hasStockIssue: boolean;
  paidAfterCancellation: boolean;
  disputedAt: string | null;
  paymentFailedAt: string | null;
  refundedAmountKobo: number;
  items: { id: string; quantity: number; productName: string }[];
};

type OrdersResponse = {
  items: OrderRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

const PAGE_SIZE = 20;

const ATTENTION_OPTIONS = [
  { label: 'All orders', value: '__all__' },
  { label: 'Needs attention', value: 'true' },
];

/** Radix Selects never take an empty string value — map the sentinel back here. */
const toFilterValue = (value: string) => (value === '__all__' ? '' : value);

/** "Ankara dress ×2, Sandals" — enough to recognise the order without opening it. */
function summariseItems(items: OrderRow['items']): string {
  const parts = items.map((item) =>
    item.quantity > 1 ? `${item.productName} ×${item.quantity}` : item.productName,
  );
  return parts.length > 2
    ? `${parts.slice(0, 2).join(', ')} +${parts.length - 2} more`
    : parts.join(', ');
}

/**
 * The orders list.
 *
 * The sidebar linked here from the start and the page did not exist, so orders
 * were only manageable from the phone. The API was already complete; this is
 * purely its caller.
 *
 * Anything that needs a human — a paid order that could not be stocked, or a
 * chargeback — is marked inline rather than left for the merchant to discover
 * by opening orders one at a time. Those are the two situations where money has
 * already moved and the store has to act.
 */
export default function OrdersView({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { filters, updateFilters, resetFilters, queryString } = useFilters({
    search: '',
    status: '',
    needsAttention: '',
    page: 1,
    pageSize: PAGE_SIZE,
  });

  // Suspend fetching until useFilters has built its first query string.
  const { data, isLoading } = useSWR<OrdersResponse>(
    queryString !== null ? `/stores/${storeSlug}/orders?${queryString}` : null,
    apiFetcher,
  );

  // Every filter change goes back to page 1. Leaving `page` alone means a
  // merchant on page 3 who narrows to "Pending" is shown an empty table and
  // concludes they have no pending orders.
  const handleSearch = (value: string) => {
    setSearch(value);
    updateFilters({ search: value, page: 1 });
  };

  const handleReset = () => {
    resetFilters();
    setSearch('');
  };

  const openOrder = (row: OrderRow) =>
    router.push(ROUTES.store.orders.detail(storeSlug, row.id));

  const columns: IColumn<OrderRow>[] = [
    {
      key: 'order',
      header: 'Order',
      accessor: (row) => (
        <div className='min-w-0'>
          <p className='font-medium text-gray-900'>#{row.orderNumber}</p>
          <p className='max-w-[260px] truncate text-xs text-gray-500'>
            {summariseItems(row.items)}
          </p>
        </div>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      accessor: (row) => (
        <div>
          <p className='text-gray-900'>{row.customerName}</p>
          <p className='text-xs text-gray-500'>{row.customerPhone}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      accessor: (row) => (
        <span className='tabular-nums'>{formatCurrency(row.totalKobo)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => {
        const badge = ORDER_STATUS_BADGE[row.status];
        const needsAttention =
          row.hasStockIssue ||
          row.paidAfterCancellation ||
          Boolean(row.disputedAt);
        return (
          <div className='flex flex-wrap items-center gap-1.5'>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium',
                badge.className,
              )}
            >
              {badge.label}
            </span>
            {needsAttention ? (
              <span
                className='inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                title={
                  row.disputedAt
                    ? 'The customer has raised a chargeback'
                    : row.paidAfterCancellation
                      ? 'Paid after this order was cancelled — send it or refund'
                      : 'Paid, but stock ran out before it could be packed'
                }
              >
                <AlertTriangle className='size-3' />
                {row.disputedAt
                  ? 'Chargeback'
                  : row.paidAfterCancellation
                    ? 'Paid after cancel'
                    : 'Stock issue'}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Placed',
      accessor: (row) => formatDate(row.createdAt, DATE_FORMATS.DISPLAY_SHORT),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      accessor: (row) => (
        <TableActionMenu
          items={[
            {
              label: 'View order',
              icon: <Eye className='size-4' />,
              onClick: () => openOrder(row),
            },
          ]}
        />
      ),
    },
  ];

  const filtered = Boolean(
    filters.search || filters.status || filters.needsAttention,
  );

  return (
    <div className='flex flex-col space-y-3.5'>
      <PageHeader
        title='Orders'
        description='Everything customers have bought from this store, newest first'
      />

      <div className='space-y-4 rounded-lg bg-white p-4'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-xl font-medium'>
            {filtered ? 'Matching orders' : 'All orders'}
            {data ? ` (${data.total})` : ''}
          </p>
          <FilterPanel
            showSearch
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder='Name, email, phone or order number…'
            onReset={handleReset}
          >
            <FilterSelect
              id='filter-order-status'
              label='Status'
              options={ORDER_STATUS_OPTIONS}
              value={filters.status || '__all__'}
              onValueChange={(v) =>
                updateFilters({ status: toFilterValue(v), page: 1 })
              }
              placeholder='All statuses'
            />
            <FilterSelect
              id='filter-order-attention'
              label='Attention'
              options={ATTENTION_OPTIONS}
              value={filters.needsAttention || '__all__'}
              onValueChange={(v) =>
                updateFilters({ needsAttention: toFilterValue(v), page: 1 })
              }
              placeholder='All orders'
            />
          </FilterPanel>
        </div>

        <TableFactory<OrderRow>
          columns={columns}
          data={data?.items ?? []}
          rowKey='id'
          isLoading={isLoading}
          onRowClick={openOrder}
          pageSize={PAGE_SIZE}
          currentPage={filters.page}
          totalItems={data?.total ?? 0}
          onPageChange={(page) => updateFilters({ page })}
          emptyState={
            <div className='py-10 text-center text-sm text-gray-500'>
              {filtered
                ? 'No orders match these filters.'
                : 'No orders yet. They appear here the moment a customer pays.'}
            </div>
          }
        />
      </div>
    </div>
  );
}
