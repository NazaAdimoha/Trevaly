import type { Metadata } from 'next';

import { requirePlatformAdmin } from '@/lib/auth';
import { listBanks } from '@/lib/payments/paystack';

import OnboardTenantView from '@/components/pages/dashboard/platform/onboard';

export const metadata: Metadata = {
  title: 'Onboard a store',
  robots: { index: false },
};

/**
 * The bank list is fetched here rather than from the client so the select is
 * populated on first paint — it is a ~280-entry list that the operator needs
 * immediately, and a round trip after hydration shows them an empty dropdown.
 */
export default async function OnboardTenantPage() {
  await requirePlatformAdmin();

  const banks = await listBanks();

  return (
    <OnboardTenantView
      banks={banks.map(({ name, code }) => ({ name, code }))}
    />
  );
}
