import { UserButton } from '@clerk/nextjs';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { requireUser } from '@/lib/auth';
// eslint-disable-next-line no-restricted-imports -- reads the signed-in user's own platform role, which is not tenant-scoped
import { prisma } from '@/lib/prisma';

import ROUTES from '@/constant/routes';

/**
 * Account bar for every authenticated surface.
 *
 * It lives here rather than in each screen because sign-out was previously
 * reachable only from the store dashboard shell — the store picker, the
 * platform estate view and the onboarding form all rendered bare, so an
 * operator working only on platform screens had no way to sign out at all.
 *
 * `requireUser()` also makes this the single redirect to sign-in for anything
 * under `/dashboard`; the per-resource checks in each page still run and are
 * still what actually authorize the data.
 */
export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const userId = await requireUser();

  // The platform link is shown only to staff — everyone else would just get
  // redirected, and advertising a door you cannot open is its own confusion.
  const platformUser = await prisma.platformUser.findUnique({
    where: { clerkUserId: userId },
    select: { role: true },
  });

  return (
    <div className='min-h-screen'>
      <header className='flex h-14 items-center justify-between border-b bg-white px-6'>
        <nav className='flex items-center gap-5 text-sm'>
          <Link href={ROUTES.dashboard.base} className='font-medium'>
            Your stores
          </Link>
          {platformUser ? (
            <Link href={ROUTES.platform.base} className='text-gray-600'>
              Platform
            </Link>
          ) : null}
        </nav>
        <UserButton />
      </header>
      {children}
    </div>
  );
}
