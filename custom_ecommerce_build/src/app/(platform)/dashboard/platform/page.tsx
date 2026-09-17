import { redirect } from 'next/navigation';

import ROUTES from '@/constant/routes';

/**
 * `/dashboard/platform` has no screen of its own. The tenants list moved to
 * `/dashboard/platform/tenants` — where the sidebar points — and this keeps any
 * bookmark or old link landing somewhere real.
 */
export default function PlatformIndexPage() {
  redirect(ROUTES.platform.tenants.base);
}
