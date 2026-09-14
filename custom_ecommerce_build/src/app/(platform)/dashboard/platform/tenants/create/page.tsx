import type { Metadata } from 'next';

import { requirePlatformAdmin } from '@/lib/auth';

import OnboardTenantView from '@/components/pages/dashboard/platform/onboard';

export const metadata: Metadata = {
  title: 'Onboard a store',
  robots: { index: false },
};

/**
 * No Paystack call here any more — the bank list is fetched by the form from
 * `GET /api/platform/banks`. See the note on `OnboardTenantView`.
 */
export default async function OnboardTenantPage() {
  await requirePlatformAdmin();
  return <OnboardTenantView />;
}
