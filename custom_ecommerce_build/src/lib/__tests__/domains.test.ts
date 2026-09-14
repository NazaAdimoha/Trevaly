import { describe, expect, it } from 'vitest';

import { classifyHostname, normalizeHostname } from '@core/hostname';
import { isPlatformHost, isReservedSlug, isValidSlug } from '@core/reserved';

const ROOT = 'yourbrand.com';

describe('normalizeHostname', () => {
  it('strips the port and lowercases', () => {
    expect(normalizeHostname('Adaobi-Store.yourbrand.com:3000')).toBe(
      'adaobi-store.yourbrand.com',
    );
  });

  it('handles a missing host', () => {
    expect(normalizeHostname(null)).toBe('');
  });
});

describe('isPlatformHost', () => {
  it('treats the root and www as platform', () => {
    expect(isPlatformHost('yourbrand.com', ROOT)).toBe(true);
    expect(isPlatformHost('www.yourbrand.com', ROOT)).toBe(true);
  });

  // Regression: without this, a preview URL resolves to a tenant slug named
  // after the git branch.
  it('never treats a Vercel preview URL as a tenant', () => {
    expect(isPlatformHost('myapp-git-main-acme.vercel.app', ROOT)).toBe(true);
  });

  it('treats a tenant subdomain as non-platform', () => {
    expect(isPlatformHost('adaobi-store.yourbrand.com', ROOT)).toBe(false);
  });

  // Regression: the Expo app on a physical device sends the machine's LAN
  // address as its Host header. Classified as a custom domain, no tenant owns
  // it, so `proxy.ts` rewrote every mobile API call to /tenant-not-found and the
  // client received HTML instead of JSON — every screen rendered empty.
  it.each(['192.168.50.81', '10.0.0.4', '172.16.3.9', '127.0.0.1'])(
    'accepts private address %s only when opted in',
    (host) => {
      expect(isPlatformHost(host, ROOT)).toBe(false);
      expect(isPlatformHost(host, ROOT, { allowPrivateHosts: true })).toBe(true);
    },
  );

  // The platform branch is the one carrying a Clerk session, so a public
  // address must never reach it on the strength of looking numeric.
  it.each(['8.8.8.8', '172.32.0.1', '11.0.0.1', '192.169.0.1'])(
    'rejects public address %s even when opted in',
    (host) => {
      expect(isPlatformHost(host, ROOT, { allowPrivateHosts: true })).toBe(
        false,
      );
    },
  );

  it('does not mistake a hostname with four dotted labels for an address', () => {
    expect(
      isPlatformHost('10.foo.bar.com', ROOT, { allowPrivateHosts: true }),
    ).toBe(false);
  });
});

describe('isReservedSlug', () => {
  // Regression: `admin.yourbrand.com` must not resolve to a tenant named "admin".
  it.each(['admin', 'www', 'api', 'app', 'checkout', 'webhooks'])(
    'reserves %s',
    (slug) => {
      expect(isReservedSlug(slug)).toBe(true);
    },
  );

  it('is case-insensitive', () => {
    expect(isReservedSlug('ADMIN')).toBe(true);
  });

  it('allows an ordinary store slug', () => {
    expect(isReservedSlug('adaobi-store')).toBe(false);
  });
});

describe('isValidSlug', () => {
  it('accepts a DNS-safe slug', () => {
    expect(isValidSlug('adaobi-store')).toBe(true);
  });

  it.each([
    ['ab', 'too short'],
    ['-leading', 'leading hyphen'],
    ['trailing-', 'trailing hyphen'],
    ['has space', 'whitespace'],
    ['Upper', 'uppercase'],
    ['admin', 'reserved'],
    ['under_score', 'underscore is not a DNS label char'],
  ])('rejects %s (%s)', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('classifyHostname', () => {
  it('reads a tenant slug straight off a subdomain, with no lookup', () => {
    expect(classifyHostname('adaobi-store.yourbrand.com', ROOT)).toEqual({
      kind: 'subdomain',
      slug: 'adaobi-store',
    });
  });

  it('supports {slug}.localhost for local development', () => {
    expect(classifyHostname('adaobi-store.localhost:3000', ROOT)).toEqual({
      kind: 'subdomain',
      slug: 'adaobi-store',
    });
  });

  it('routes an unknown apex domain to a custom-domain lookup', () => {
    expect(classifyHostname('adaobistore.com', ROOT)).toEqual({
      kind: 'custom-domain',
      hostname: 'adaobistore.com',
    });
  });

  it('treats a reserved subdomain as platform, never a tenant', () => {
    expect(classifyHostname('admin.yourbrand.com', ROOT)).toEqual({
      kind: 'platform',
    });
  });

  it('rejects multi-level subdomains', () => {
    expect(classifyHostname('a.b.yourbrand.com', ROOT)).toEqual({
      kind: 'unknown',
    });
  });
});
