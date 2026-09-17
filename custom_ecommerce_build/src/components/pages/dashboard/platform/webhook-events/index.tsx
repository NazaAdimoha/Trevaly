'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { apiFetcher } from '@/lib/api';
import { cn, DATE_FORMATS, formatDate } from '@/lib/utils';

import { type IColumn, TableFactory } from '@/components/ui/table-factory';

import type { WebhookStatus } from '@core/enums';

type WebhookEventRow = {
  id: string;
  provider: string;
  eventType: string;
  reference: string | null;
  tenantId: string | null;
  status: WebhookStatus;
  error: string | null;
  attempts: number;
  createdAt: string;
  processedAt: string | null;
};

type Response = {
  items: WebhookEventRow[];
  total: number;
  counts: Record<WebhookStatus, number>;
};

const PAGE_SIZE = 25;

const STATUS_STYLE: Record<WebhookStatus, string> = {
  RECEIVED: 'bg-blue-50 text-blue-700',
  PROCESSED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  IGNORED: 'bg-gray-100 text-gray-600',
};

/**
 * Status filter as tabs, with counts, FAILED first.
 *
 * FAILED leads because it is the only state that means money may be stuck: a
 * paid order that was never fulfilled. RECEIVED is next — a row still RECEIVED
 * long after arrival is a delivery that crashed mid-processing.
 */
const TABS: { label: string; value: WebhookStatus | '' }[] = [
  { label: 'Failed', value: 'FAILED' },
  { label: 'Received', value: 'RECEIVED' },
  { label: 'Processed', value: 'PROCESSED' },
  { label: 'Ignored', value: 'IGNORED' },
  { label: 'All', value: '' },
];

export default function WebhookEventsView() {
  const [status, setStatus] = useState<WebhookStatus | ''>('FAILED');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
    ...(status ? { status } : {}),
  });

  const { data, isLoading, error } = useSWR<Response>(
    `/platform/webhook-events?${params.toString()}`,
    apiFetcher,
  );

  const columns: IColumn<WebhookEventRow>[] = [
    {
      key: 'event',
      header: 'Event',
      accessor: (row) => (
        <div>
          <p className='font-medium text-gray-900'>{row.eventType}</p>
          <p className='text-xs text-gray-500'>{row.provider}</p>
        </div>
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      accessor: (row) => (
        <code className='text-xs break-all text-gray-600'>
          {row.reference ?? '—'}
        </code>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => (
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            STATUS_STYLE[row.status],
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      key: 'detail',
      header: 'Detail',
      accessor: (row) =>
        row.error ? (
          <span
            className={cn(
              'text-xs',
              row.status === 'FAILED' ? 'text-red-700' : 'text-gray-500',
            )}
          >
            {row.error}
          </span>
        ) : (
          <span className='text-xs text-gray-400'>—</span>
        ),
    },
    {
      key: 'attempts',
      header: 'Deliveries',
      align: 'right',
      // Paystack redelivers on a 5xx. A high count is a handler that keeps
      // failing on the same event, not traffic.
      accessor: (row) => (
        <span className='tabular-nums'>{row.attempts + 1}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Received',
      accessor: (row) => formatDate(row.createdAt, DATE_FORMATS.DISPLAY_WITH_TIME),
    },
  ];

  return (
    <div className='mx-auto max-w-6xl px-6 py-12'>
      <h1 className='text-2xl font-semibold'>Webhook events</h1>
      <p className='mt-1 max-w-2xl text-sm text-gray-600'>
        Every payment event Paystack sends, stored before it is processed. A
        failed event is kept rather than dropped — if one is here, a payment may
        have succeeded without its order being fulfilled.
      </p>

      <div
        role='tablist'
        className='mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3'
      >
        {TABS.map((tab) => {
          const active = tab.value === status;
          const count =
            data && tab.value ? data.counts[tab.value] : data?.total;
          return (
            <button
              key={tab.label}
              type='button'
              role='tab'
              aria-selected={active}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn(
                'rounded-full px-3 py-1.5 text-sm',
                active
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
              )}
            >
              {tab.label}
              {count !== undefined && tab.value ? (
                <span
                  className={cn(
                    'ml-1.5 tabular-nums',
                    tab.value === 'FAILED' && count > 0 && !active
                      ? 'font-semibold text-red-700'
                      : '',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className='mt-4'>
        {error ? (
          <p role='alert' className='py-10 text-center text-red-700'>
            Could not load webhook events. Refresh to try again.
          </p>
        ) : (
          <TableFactory<WebhookEventRow>
            columns={columns}
            data={data?.items ?? []}
            rowKey='id'
            isLoading={isLoading}
            pageSize={PAGE_SIZE}
            currentPage={page}
            totalItems={data?.total ?? 0}
            onPageChange={setPage}
            emptyState={
              <div className='py-10 text-center text-sm text-gray-500'>
                {status === 'FAILED'
                  ? 'No failed events. Every delivery has been processed.'
                  : 'No events here.'}
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
