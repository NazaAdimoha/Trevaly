import Link from 'next/link';

import ROUTES from '@/constant/routes';
import type { TenantStatus } from '@/generated/prisma/enums';

type PlatformTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  customDomain: string | null;
  paystackSubaccountCode: string | null;
  platformFeePercent: string;
  createdAt: string;
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

export default function PlatformTenantsView({
  tenants,
}: {
  tenants: PlatformTenant[];
}) {
  return (
    <div className='mx-auto max-w-6xl px-6 py-12'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-2xl font-semibold'>Tenants</h1>
          <p className='mt-1 text-sm text-gray-600'>
            {tenants.length} store{tenants.length === 1 ? '' : 's'} on the
            platform.
          </p>
        </div>
        <Link
          href={ROUTES.platform.tenants.create}
          className='rounded-md bg-purple-700 px-4 py-2 text-sm font-medium text-white'
        >
          Onboard a store
        </Link>
      </div>

      {tenants.length === 0 ? (
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
                    <div className='text-xs text-gray-500'>
                      {tenant.customDomain ?? `${tenant.slug}.yourbrand.com`}
                    </div>
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
