import type { Env } from '../config/env';

/**
 * A tenant's ONE canonical origin — ported from web's `domains/canonical.ts`.
 *
 * A store with a verified custom domain is reachable at two hostnames serving
 * identical HTML. The custom domain wins once verified; before that the
 * subdomain is the only address that resolves.
 */
export type CanonicalTenant = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

export function tenantOrigin(
  tenant: CanonicalTenant,
  env: Pick<Env, 'ROOT_DOMAIN' | 'NODE_ENV'>,
): string {
  if (tenant.customDomain && tenant.customDomainVerified) {
    return `https://${tenant.customDomain}`;
  }
  // Development serves storefronts from `{slug}.localhost:3000`, matching the
  // web proxy's hostname classification.
  if (env.NODE_ENV === 'development') {
    return `http://${tenant.slug}.localhost:3000`;
  }
  return `https://${tenant.slug}.${env.ROOT_DOMAIN}`;
}

/**
 * The storefront origin a shopper is on, for Paystack's `callback_url`.
 *
 * Web used the request's own origin. Behind the proxy the API's host is its
 * own, so the proxy forwards the original host in `x-forwarded-host`. It is
 * accepted only when it is one of THIS tenant's addresses — otherwise a crafted
 * header could send a paying customer back to any site after payment. Anything
 * else falls back to the canonical origin (plan Part 4, row 10).
 */
export function storefrontOrigin(
  forwardedHost: string | undefined,
  forwardedProto: string | undefined,
  tenant: CanonicalTenant,
  env: Pick<Env, 'ROOT_DOMAIN' | 'NODE_ENV'>,
): string {
  const host = forwardedHost?.split(',')[0]?.trim().toLowerCase();
  if (host) {
    const hostname = host.split(':')[0];
    const own =
      hostname === `${tenant.slug}.${env.ROOT_DOMAIN}` ||
      (tenant.customDomainVerified && hostname === tenant.customDomain) ||
      (env.NODE_ENV === 'development' && hostname === `${tenant.slug}.localhost`);
    if (own) {
      const proto = forwardedProto?.split(',')[0]?.trim() === 'http' ? 'http' : 'https';
      return `${proto}://${host}`;
    }
  }
  return tenantOrigin(tenant, env);
}
