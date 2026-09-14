import type { Metadata } from 'next';

import { requirePlatformAdmin } from '@/lib/auth';

import PlatformTenantsView from '@/components/pages/dashboard/platform';

export const metadata: Metadata = {
  title: 'Tenants',
  robots: { index: false },
};

/**
 * The operator's store list — at the URL the sidebar has always linked to.
 *
 * It used to live at `/dashboard/platform` while the sidebar pointed here, so
 * the operator's first click 404'd.
 *
 * `requirePlatformAdmin()` stays on the server even though the data now comes
 * from the API (which checks again): this is the one screen that reads across
 * tenant boundaries, and a non-operator should be redirected before the page
 * shell renders, not shown an empty table.
 */
export default async function PlatformTenantsPage() {
  await requirePlatformAdmin();
  return <PlatformTenantsView />;
}
