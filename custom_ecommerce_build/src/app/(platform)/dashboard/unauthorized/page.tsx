import type { Metadata } from 'next';
import Link from 'next/link';

import ROUTES from '@/constant/routes';

export const metadata: Metadata = {
  title: 'Not allowed',
  robots: { index: false },
};

/**
 * Where `requireStoreOwner()` and `requirePlatformAdmin()` send someone who is
 * signed in but lacks the role. `ROUTES.unauthorized` has always pointed here;
 * the page itself did not exist, so a staff member who opened an owner-only
 * action got a 404 that read as a broken app rather than a refusal.
 *
 * Deliberately says nothing about what the resource was.
 */
export default function UnauthorizedPage() {
  return (
    <main className='mx-auto max-w-lg px-6 py-24 text-center'>
      <h1 className='text-xl font-semibold'>You do not have access</h1>
      <p className='mt-2 text-gray-600'>
        Your account does not have permission for this page. If you think it
        should, ask the store owner to update your role.
      </p>
      <Link
        href={ROUTES.dashboard.base}
        className='mt-6 inline-block text-sm underline'
      >
        Back to your stores
      </Link>
    </main>
  );
}
