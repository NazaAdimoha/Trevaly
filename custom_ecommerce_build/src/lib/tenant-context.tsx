'use client';

import { createContext, type ReactNode, useContext } from 'react';

import type { StorefrontTheme } from '@core/enums';

/** Branding-safe subset of Tenant. Never expose subaccount codes to the client. */
export type PublicTenant = {
  id: string;
  name: string;
  slug: string;
  logoPublicId: string | null;
  primaryColor: string | null;
  tagline: string | null;
  theme: StorefrontTheme;
  contactEmail: string | null;
  whatsappNumber: string | null;
  currency: string;
};

const TenantContext = createContext<PublicTenant | null>(null);

export function TenantProvider({
  tenant,
  children,
}: {
  tenant: PublicTenant;
  children: ReactNode;
}) {
  return (
    <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>
  );
}

/** Reads the current storefront's tenant. Throws outside a storefront tree. */
export function useTenant(): PublicTenant {
  const tenant = useContext(TenantContext);
  if (!tenant) {
    throw new Error(
      'useTenant() must be used inside a storefront TenantProvider',
    );
  }
  return tenant;
}
