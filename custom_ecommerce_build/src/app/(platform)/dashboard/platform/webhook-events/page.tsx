import type { Metadata } from 'next';

import { requirePlatformAdmin } from '@/lib/auth';

import WebhookEventsView from '@/components/pages/dashboard/platform/webhook-events';

export const metadata: Metadata = {
  title: 'Webhook events',
  robots: { index: false },
};

/** Linked from the operator sidebar since it was first drawn; 404'd until now. */
export default async function WebhookEventsPage() {
  await requirePlatformAdmin();
  return <WebhookEventsView />;
}
