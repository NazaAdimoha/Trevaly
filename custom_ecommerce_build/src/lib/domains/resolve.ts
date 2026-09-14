import { LRUCache } from 'lru-cache';

import { classifyHostname, normalizeHostname } from '@core/hostname';

import { prisma } from '@/lib/prisma';

/**
 * Hostname -> tenant slug resolution.
 *
 * Note on the original design: the pricing doc routed custom-domain lookups
 * through a fetch to `/api/internal/resolve-domain` with
 * `next: { revalidate: 300 }`, because Edge middleware could not reach Prisma.
 * Two problems — the Next Data Cache is not available in middleware at all, so
 * that fetch was uncached and cost a full extra serverless invocation on every
 * request to a custom domain; and as of Next.js 16 `proxy.ts` runs on the Node
 * runtime, so the indirection is unnecessary. We query directly and cache here.
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

/**
 * Safe to call on every request: subdomain hits never touch the database, and
 * a custom domain hits it at most once per TTL.
 */
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

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { customDomain: hostname },
      select: { slug: true, customDomainVerified: true },
    });

    if (!tenant?.customDomainVerified) {
      cache.set(hostname, NEGATIVE, { ttl: NEGATIVE_TTL });
      return null;
    }

    cache.set(hostname, tenant.slug);
    return tenant.slug;
  } catch {
    // Never cache an infrastructure failure as "no such tenant".
    return null;
  }
}

/** Call after attaching or detaching a custom domain so the change is instant. */
export function invalidateDomain(hostname: string): void {
  cache.delete(normalizeHostname(hostname));
}

export { normalizeHostname } from '@core/hostname';
