import type { Metadata } from 'next';

import { requireTenantMember } from '@/lib/auth';

import StoreSettingsView from '@/components/pages/dashboard/stores/settings';

export const metadata: Metadata = { title: 'Store settings' };

export default async function StoreSettingsPage({
  params,
}: {
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { storefrontUrl } = await requireTenantMember(storeSlug);

  return (
    <StoreSettingsView
      storeSlug={storeSlug}
      // Resolved on the server: whether a store answers on its own domain or
      // on {slug}.{root} depends on `customDomainVerified`, which the browser
      // has no business knowing.
      storefrontUrl={storefrontUrl}
    />
  );
}
