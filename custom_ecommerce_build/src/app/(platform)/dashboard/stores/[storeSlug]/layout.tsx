import type { ReactNode } from 'react';

import { requireTenantMember } from '@/lib/auth';

import DashboardLayout from '@/components/Layouts/Dashboard';

import { storeMenu } from '@/constant/menu';

/**
 * Authorization boundary for a store's admin.
 *
 * `requireTenantMember` checks membership against the slug in the URL, so a
 * user who edits the address bar to another store's slug gets a 404 rather than
 * that store's data. Every nested page inherits this — but API routes do NOT,
 * and must call the same helper themselves.
 */
export default async function StoreAdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ storeSlug: string }>;
}) {
  const { storeSlug } = await params;
  const { tenant } = await requireTenantMember(storeSlug);

  return (
    <DashboardLayout
      items={storeMenu(storeSlug)}
      storeName={tenant.name}
      storeSlug={tenant.slug}
    >
      {children}
    </DashboardLayout>
  );
}
