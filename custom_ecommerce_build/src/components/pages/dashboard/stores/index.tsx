import Link from 'next/link';

import ROUTES from '@/constant/routes';
import type { TenantRole, TenantStatus } from '@/generated/prisma/enums';

type StoreListItem = {
  tenant: { id: string; name: string; slug: string; status: TenantStatus };
  role: TenantRole;
};

/**
 * Landing view for a signed-in user.
 *
 * Stores are always addressed by slug in the URL rather than held as implicit
 * "active store" state, so every admin page is deep-linkable and
 * `requireTenantMember()` can authorize against the URL itself.
 */
export default function StoreSwitcher({ stores }: { stores: StoreListItem[] }) {
  if (stores.length === 0) {
    return (
      <div className='mx-auto max-w-xl px-6 py-24 text-center'>
        <h1 className='text-xl font-semibold'>No stores yet</h1>
        <p className='mt-2 text-gray-600'>
          Your account is not linked to a store. Contact your administrator.
        </p>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-3xl px-6 py-12'>
      <h1 className='text-2xl font-semibold'>Your stores</h1>
      <ul className='mt-6 space-y-3'>
        {stores.map(({ tenant, role }) => (
          <li key={tenant.id}>
            <Link
              href={ROUTES.store.base(tenant.slug)}
              className='flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50'
            >
              <span>
                <span className='font-medium'>{tenant.name}</span>
                <span className='ml-2 text-sm text-gray-500'>
                  {tenant.slug}
                </span>
              </span>
              <span className='text-xs text-gray-500 uppercase'>{role}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
