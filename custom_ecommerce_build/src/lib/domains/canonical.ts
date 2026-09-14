/**
 * A tenant's ONE canonical origin.
 *
 * A store with a verified custom domain is reachable at two hostnames that
 * serve byte-identical HTML — `shop.yourbrand.com` and `shop.com`. To a search
 * engine those are two competing documents for the same content, and ranking
 * signals get split between them. Every storefront page therefore declares a
 * canonical built from this function, and only this function.
 *
 * The rule: the custom domain wins once verified, because that is the address
 * the tenant advertises and the one they would rather own. Before verification
 * the subdomain is the only address that resolves, so it is canonical.
 *
 * Kept separate from `resolve.ts` for the same reason `hostname.ts` is — no
 * Prisma import, so it can be unit-tested and called from anywhere.
 */

export type CanonicalTenant = {
  slug: string;
  customDomain: string | null;
  customDomainVerified: boolean;
};

export function tenantOrigin(
  tenant: CanonicalTenant,
  rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com',
): string {
  if (tenant.customDomain && tenant.customDomainVerified) {
    return `https://${tenant.customDomain}`;
  }

  // Development serves storefronts from `{slug}.localhost:3000`, matching
  // `classifyHostname`. Emitting an https://…yourbrand.com canonical locally
  // would make every dev page claim to be the production one.
  if (process.env.NODE_ENV === 'development') {
    return `http://${tenant.slug}.localhost:3000`;
  }

  return `https://${tenant.slug}.${rootDomain}`;
}

export function tenantUrl(
  tenant: CanonicalTenant,
  path = '/',
  rootDomain?: string,
): string {
  const origin = tenantOrigin(tenant, rootDomain);
  return path === '/' ? origin : `${origin}${path}`;
}
