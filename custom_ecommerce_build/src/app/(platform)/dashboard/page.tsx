import type { Metadata } from 'next';

import { listMyStores } from '@/lib/auth';

import StoreSwitcher from '@/components/pages/dashboard/stores';

export const metadata: Metadata = { title: 'Your stores' };

/** Landing for a signed-in user: every store they may administer. */
export default async function DashboardPage() {
  const stores = await listMyStores();
  return <StoreSwitcher stores={stores} />;
}
