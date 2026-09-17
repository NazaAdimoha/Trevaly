import { LRUCache } from 'lru-cache';

import { classifyHostname, normalizeHostname } from '@core/hostname';

/**
 * Hostname -> tenant slug resolution, for `proxy.ts`.
 *
 * Subdomains resolve with no lookup at all, so an API outage can never take a
 * subdomain storefront offline at the routing step. A custom domain is looked
 * up through the API's internal endpoint (the web app has no database) and
 * cached here exactly as the direct query was: 5 minutes for a hit, 30 seconds
 * for a miss, and a failure never cached as "no such tenant".
 */

const NEGATIVE = Symbol('not-found');

const cache = new LRUCache<string, string | typeof NEGATIVE>({
  max: 5_000,
  ttl: 5 * 60 * 1000,
});

/** Negative results expire fast so a newly-attached domain goes live quickly. */
const NEGATIVE_TTL = 30 * 1000;

export type TenantResolution =
  { kind: 'platform' } | { kind: 'tenant'; slug: string } | { kind: 'unknown' };

export async function resolveHostname(
  host: string | null | undefined,
  rootDomain: string,
): Promise<TenantResolution> {
  // Physical devices in development reach this server at the machine's LAN
  // address, which is otherwise classified as an unowned custom domain. Never
  // in production — see `PlatformHostOptions.allowPrivateHosts`.
  const classified = classifyHostname(host, rootDomain, {
    allowPrivateHosts: process.env.NODE_ENV !== 'production',
  });

  switch (classified.kind) {
    case 'platform':
      return { kind: 'platform' };
    case 'subdomain':
      return { kind: 'tenant', slug: classified.slug };
    case 'unknown':
      return { kind: 'unknown' };
    case 'custom-domain': {
      const slug = await resolveCustomDomain(classified.hostname);
      return slug ? { kind: 'tenant', slug } : { kind: 'unknown' };
    }
  }
}

async function resolveCustomDomain(hostname: string): Promise<string | null> {
  const cached = cache.get(hostname);
  if (cached === NEGATIVE) return null;
  if (typeof cached === 'string') return cached;

  const origin = process.env.API_ORIGIN;
  const key = process.env.INTERNAL_API_KEY;
  if (!origin || !key) return null;

  try {
    const res = await fetch(
      `${origin.replace(/\/+$/, '')}/api/internal/domains/${encodeURIComponent(hostname)}`,
      {
        headers: { 'x-internal-key': key },
        cache: 'no-store',
        // Routing must not hang on a slow API; an unresolved domain shows the
        // not-found page and is retried on the next request.
        signal: AbortSignal.timeout(3_000),
      },
    );

    if (res.status === 404) {
      cache.set(hostname, NEGATIVE, { ttl: NEGATIVE_TTL });
      return null;
    }
    if (!res.ok) return null; // never cache an infrastructure failure

    const { slug } = (await res.json()) as { slug: string };
    cache.set(hostname, slug);
    return slug;
  } catch {
    return null;
  }
}

/** Call after attaching or detaching a custom domain so the change is instant. */
export function invalidateDomain(hostname: string): void {
  cache.delete(normalizeHostname(hostname));
}

export { normalizeHostname } from '@core/hostname';
