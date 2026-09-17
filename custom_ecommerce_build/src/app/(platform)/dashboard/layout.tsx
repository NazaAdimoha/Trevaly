import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { getPlatformRole } from '@/lib/auth';

import { Toaster } from '@/components/ui/sonner';

import ROUTES from '@/constant/routes';

/**
 * Account bar for every authenticated surface.
 *
 * It lives here rather than in each screen because sign-out was previously
 * reachable only from the store dashboard shell — the store picker, the
 * platform estate view and the onboarding form all rendered bare, so an
 * operator working only on platform screens had no way to sign out at all.
 *
 * `getPlatformRole()` signs the user in first, which makes this the single
 * redirect to sign-in for anything under `/dashboard`; the per-resource checks
 * in each page still run, and the API authorizes every data call again.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  // The platform link is shown only to staff — everyone else would just get
  // redirected, and advertising a door you cannot open is its own confusion.
  const platformRole = await getPlatformRole();

  return (
    /* The toaster lives here rather than in the root layout: every mutation
       that raises one is in this subtree, and mounting it globally shipped the
       toast runtime to every storefront page, where nothing ever toasts.
       Checkout shows its errors inline on purpose — a customer mid-payment
       misses a toast. */
    <div className='min-h-screen'>
      <header className='flex h-14 items-center justify-between border-b bg-white px-6'>
        <nav className='flex items-center gap-5 text-sm'>
          <Link href={ROUTES.dashboard.base} className='font-medium'>
            Your stores
          </Link>
          {platformRole ? (
            <Link href={ROUTES.platform.base} className='text-gray-600'>
              Platform
            </Link>
          ) : null}
        </nav>
        <UserButton />
      </header>
      {children}
      <Toaster position='top-right' richColors />
    </div>
  );
}
