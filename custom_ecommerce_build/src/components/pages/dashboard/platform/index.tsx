'use client';

import Link from 'next/link';
import useSWR from 'swr';

import type { TenantStatus } from '@core/enums';

import { apiFetcher } from '@/lib/api';

import ROUTES from '@/constant/routes';

type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  customDomain: string | null;
  paystackSubaccountCode: string | null;
  platformFeePercent: string;
  createdAt: string;
  storefrontUrl: string;
  _count: { products: number; orders: number };
};

const STATUS_STYLES: Record<TenantStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  ONBOARDING: 'bg-amber-100 text-amber-800',
  SUSPENDED: 'bg-red-100 text-red-800',
};

/**
 * A subaccount code the seed script invented rather than one Paystack issued.
 * These look wired up but fail at `/transaction/initialize`, so the store takes
 * orders right up to the payment step and then 503s.
 */
const isPlaceholderSubaccount = (code: string | null) =>
  Boolean(code?.startsWith('ACCT_seed_'));

function SettlementCell({ tenant }: { tenant: PlatformTenant }) {
  if (!tenant.paystackSubaccountCode) {
    return <span className='text-red-600'>No subaccount — cannot be paid</span>;
  }
  if (isPlaceholderSubaccount(tenant.paystackSubaccountCode)) {
    return (
      <span className='text-red-600'>
        Placeholder — checkout will fail at payment
      </span>
    );
  }
  return (
    <code className='text-xs text-gray-600'>
      {tenant.paystackSubaccountCode}
    </code>
  );
}

/**
 * Every store on the platform.
 *
 * Reads through `GET /api/platform/tenants` rather than querying Prisma in the
 * page. That endpoint existed with no caller, while this screen ran the
 * identical query server-side — two copies of one read. The migration plan ends
 * with Next.js holding no database URL, so the API copy is the one that
 * survives; this makes it the only one.
 */
export default function PlatformTenantsView() {
  const { data, error, isLoading } = useSWR<{ tenants: PlatformTenant[] }>(
    '/platform/tenants',
    apiFetcher,
  );
  const tenants = data?.tenants ?? [];

  return (
    <div className='mx-auto max-w-6xl px-6 py-12'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Tenants</h1>
          <p className='mt-1 text-sm text-gray-600'>
            {data
              ? `${tenants.length} store${tenants.length === 1 ? '' : 's'} on the platform.`
              : 'Loading stores…'}
          </p>
        </div>
        <Link
          href={ROUTES.platform.tenants.create}
          className='rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white'
        >
          Onboard a store
        </Link>
      </div>

      {error ? (
        <p role='alert' className='mt-12 text-center text-red-700'>
          Could not load stores. Refresh to try again.
        </p>
      ) : isLoading ? (
        <p className='mt-12 text-center text-gray-500'>Loading stores…</p>
      ) : tenants.length === 0 ? (
        <p className='mt-12 text-center text-gray-600'>
          No tenants yet. Onboard the first one.
        </p>
      ) : (
        <div className='mt-8 overflow-x-auto rounded-lg border'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-gray-50 text-xs text-gray-600 uppercase'>
              <tr>
                <th className='px-4 py-3'>Store</th>
                <th className='px-4 py-3'>Status</th>
                <th className='px-4 py-3'>Settlement</th>
                <th className='px-4 py-3'>Fee</th>
                <th className='px-4 py-3'>Catalogue</th>
                <th className='px-4 py-3'>Orders</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {tenants.map((tenant) => (
                <tr key={tenant.id} className='hover:bg-gray-50'>
                  <td className='px-4 py-3'>
                    <Link
                      href={ROUTES.store.base(tenant.slug)}
                      className='font-medium hover:underline'
                    >
                      {tenant.name}
                    </Link>
                    <a
                      href={tenant.storefrontUrl}
                      target='_blank'
                      rel='noreferrer'
                      className='text-xs text-gray-500 hover:underline'
                    >
                      {tenant.storefrontUrl.replace(/^https?:\/\//, '')}
                    </a>
                  </td>
                  <td className='px-4 py-3'>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[tenant.status]}`}
                    >
                      {tenant.status}
                    </span>
                  </td>
                  <td className='px-4 py-3'>
                    <SettlementCell tenant={tenant} />
                  </td>
                  <td className='px-4 py-3'>{tenant.platformFeePercent}%</td>
                  <td className='px-4 py-3'>{tenant._count.products}</td>
                  <td className='px-4 py-3'>{tenant._count.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
