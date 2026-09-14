'use client';

import { Eye, Pencil, PlusIcon, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import useSWR from 'swr';

import { api, apiFetcher, handleApiError } from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { useFilters } from '@/hooks/use-filters';

import { FilterSelect } from '@/components/fields/FilterSelect';
import ButtonLink from '@/components/links/ButtonLink';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { FilterPanel } from '@/components/ui/filter-panel';
import PageHeader from '@/components/ui/pageHeader';
import { TableActionMenu } from '@/components/ui/table-action-menu';
import { type IColumn, TableFactory } from '@/components/ui/table-factory';

import ROUTES from '@/constant/routes';

import {
  LOW_STOCK_THRESHOLD,
  PRODUCT_STATUS_OPTIONS,
  STATUS_BADGE,
} from './constants';

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  priceKobo: number;
  stock: number;
  isActive: boolean;
  createdAt: string;
};

type ProductsResponse = {
  items: ProductRow[];
  total: number;
  page: number;
  pageCount: number;
};

/** Radix Selects never take an empty string value — map the sentinel back here. */
const toFilterValue = (value: string) => (value === '__all__' ? '' : value);

export default function ProductsView({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pendingDelete, setPendingDelete] = useState<ProductRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { filters, updateFilter, resetFilters, queryString } = useFilters({
    search: '',
    isActive: '',
    page: 1,
  });

  // Suspend fetching until useFilters has built its first query string.
  const { data, isLoading, mutate } = useSWR<ProductsResponse>(
    queryString !== null
      ? `/stores/${storeSlug}/products?${queryString}`
      : null,
    apiFetcher,
  );

  const handleReset = () => {
    resetFilters();
    setSearch('');
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    updateFilter('search', value);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await api.delete(`/stores/${storeSlug}/products/${pendingDelete.id}`);
      toast.success(`${pendingDelete.name} deleted`);
      setPendingDelete(null);
      void mutate();
    } catch (err) {
      handleApiError(err);
    } finally {
      setDeleting(false);
    }
  };

  const columns: IColumn<ProductRow>[] = [
    { key: 'name', header: 'Product', accessor: 'name' },
    {
      key: 'sku',
      header: 'SKU',
      accessor: (row) => row.sku ?? '—',
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      accessor: (row) => formatCurrency(row.priceKobo),
    },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      accessor: (row) => (
        <span
          className={cn(
            row.stock === 0 && 'font-medium text-red-600',
            row.stock > 0 &&
              row.stock <= LOW_STOCK_THRESHOLD &&
              'text-amber-600',
          )}
        >
          {row.stock}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => {
        const badge = STATUS_BADGE[row.isActive ? 'active' : 'inactive'];
        return (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              badge.className,
            )}
          >
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      header: 'Added',
      accessor: (row) => formatDate(row.createdAt),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      accessor: (row) => (
        <TableActionMenu
          items={[
            {
              label: 'View',
              icon: <Eye className='size-4' />,
              onClick: () =>
                router.push(ROUTES.store.products.detail(storeSlug, row.id)),
            },
            {
              label: 'Edit',
              icon: <Pencil className='size-4' />,
              onClick: () =>
                router.push(ROUTES.store.products.edit(storeSlug, row.id)),
            },
            {
              label: 'Delete',
              icon: <Trash2 className='size-4' />,
              variant: 'destructive',
              separator: true,
              onClick: () => setPendingDelete(row),
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className='flex flex-col space-y-3.5'>
      <div className='flex items-center justify-between'>
        <PageHeader
          title='Products'
          description='Everything customers can buy from this store'
        />
        <div className='flex items-center gap-3'>
          {/* Import sits beside Add, not behind a menu: a store's first job is
              getting a catalogue in, and one at a time is the slow way. */}
          <ButtonLink
            href={ROUTES.store.products.import(storeSlug)}
            variant='outline'
          >
            Import CSV
          </ButtonLink>
          <ButtonLink
            href={ROUTES.store.products.create(storeSlug)}
            leftIcon={PlusIcon}
          >
            Add product
          </ButtonLink>
        </div>
      </div>

      <div className='space-y-4 rounded-lg bg-white p-4'>
        <div className='flex items-center justify-between'>
          <p className='text-xl font-medium'>
            All products{data ? ` (${data.total})` : ''}
          </p>
          <FilterPanel
            showSearch
            searchValue={search}
            onSearchChange={handleSearch}
            searchPlaceholder='Search name or SKU...'
            onReset={handleReset}
          >
            <FilterSelect
              id='filter-status'
              label='Status'
              options={PRODUCT_STATUS_OPTIONS}
              value={filters.isActive || '__all__'}
              onValueChange={(v) => updateFilter('isActive', toFilterValue(v))}
              placeholder='All statuses'
            />
          </FilterPanel>
        </div>

        <TableFactory<ProductRow>
          columns={columns}
          data={data?.items ?? []}
          rowKey='id'
          isLoading={isLoading}
          onRowClick={(row) =>
            router.push(ROUTES.store.products.detail(storeSlug, row.id))
          }
          emptyState={
            <div className='py-10 text-center text-sm text-gray-500'>
              No products yet. Add your first one to start selling.
            </div>
          }
        />
      </div>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <DialogContent>
          <DialogTitle>Delete product</DialogTitle>
          <p className='text-sm text-gray-600'>
            Delete <strong>{pendingDelete?.name}</strong>? Products that already
            appear on an order cannot be deleted — mark them inactive instead.
          </p>
          <div className='mt-4 flex justify-end gap-2'>
            <button
              type='button'
              className='rounded-md border px-4 py-2 text-sm'
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type='button'
              className='rounded-md bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50'
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
