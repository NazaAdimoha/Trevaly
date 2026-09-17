import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';

import type { MyStoresResponse } from '@core/api/contracts';
import type {
  PlatformRole,
  StorefrontTheme,
  TenantRole,
  TenantStatus,
} from '@core/enums';
import { TenantRole as TenantRoles } from '@core/enums';

import { apiGet,ApiRequestError } from '@/lib/server-api';

import ROUTES from '@/constant/routes';

/**
 * Authorization for the dashboard's Server Components.
 *
 * Clerk owns identity; tenancy is decided by the API, which checks the
 * `TenantUser` table on every call. These helpers only translate the API's
 * answer into navigation: 401 → sign in, 404 → not found, 403 → unauthorized.
 *
 * The API authorizes again on every data call, so a page skipping one of these
 * would show an empty shell, never another store's data.
 */

/** The store as the API returns it to a member. Dates arrive as ISO strings. */
export type MemberTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  theme: StorefrontTheme;
  tagline: string | null;
  logoPublicId: string | null;
  primaryColor: string | null;
  customDomain: string | null;
  customDomainVerified: boolean;
  currency: string;
};

type StoreResponse = {
  tenant: MemberTenant;
  role: TenantRole;
  viaPlatform: boolean;
  storefrontUrl: string;
};

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect(ROUTES.signIn);
  return userId;
}

function redirectFor(err: unknown): never {
  if (err instanceof ApiRequestError) {
    if (err.status === 401) redirect(ROUTES.signIn);
    if (err.status === 403) redirect(ROUTES.unauthorized);
    if (err.status === 404) notFound();
  }
  throw err;
}

/**
 * Assert the signed-in user may administer `storeSlug`.
 *
 * Cached per request: the store layout and the page beneath it both ask, and
 * that must cost one API call, not two.
 */
export const requireTenantMember = cache(async (storeSlug: string) => {
  const userId = await requireUser();
  try {
    const store = await apiGet<StoreResponse>(`/stores/${encodeURIComponent(storeSlug)}`, {
      signedIn: true,
    });
    return { ...store, userId };
  } catch (err) {
    return redirectFor(err);
  }
});

export async function requireStoreOwner(storeSlug: string) {
  const context = await requireTenantMember(storeSlug);
  if (context.role !== TenantRoles.OWNER) redirect(ROUTES.unauthorized);
  return context;
}

/** The signed-in user's platform role, or null. Cached per request. */
export const getPlatformRole = cache(async (): Promise<PlatformRole | null> => {
  await requireUser();
  try {
    const me = await apiGet<{ userId: string; platformRole: PlatformRole | null }>('/me', {
      signedIn: true,
    });
    return me.platformRole;
  } catch (err) {
    return redirectFor(err);
  }
});

export async function requirePlatformAdmin() {
  const userId = await requireUser();
  const platformRole = await getPlatformRole();
  if (platformRole !== 'SUPER_ADMIN') redirect(ROUTES.unauthorized);
  return { userId, platformRole };
}

/** Every store the signed-in user can administer — drives the store switcher. */
export async function listMyStores() {
  await requireUser();
  try {
    const { items } = await apiGet<MyStoresResponse>('/me/stores', { signedIn: true });
    return items.map((store) => ({
      tenant: { id: store.id, name: store.name, slug: store.slug, status: store.status },
      role: store.role,
    }));
  } catch (err) {
    return redirectFor(err);
  }
}
