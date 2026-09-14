/**
 * Subdomains that must never resolve to a tenant storefront.
 *
 * Without this list, `admin.yourbrand.com` resolves to a tenant with slug
 * "admin", and a Vercel preview URL like `myapp-git-main-x.vercel.app`
 * resolves to a tenant named after the branch.
 *
 * Enforced in two places: here at request time, and at tenant creation so a
 * reserved slug can never be persisted in the first place.
 */
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "dashboard",
  "api",
  "auth",
  "login",
  "signin",
  "signup",
  "clerk",
  "accounts",
  "mail",
  "email",
  "smtp",
  "ftp",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "static",
  "assets",
  "cdn",
  "img",
  "images",
  "media",
  "files",
  "store",
  "shop",
  "checkout",
  "pay",
  "payments",
  "billing",
  "webhook",
  "webhooks",
  "internal",
  "staging",
  "dev",
  "test",
  "preview",
  "demo",
]);

/**
 * Loopback and RFC1918 addresses — the machine itself, or another device on the
 * same wifi. Deliberately IPv4-only: these arrive as a bare `host` header from a
 * development client, and IPv6 literals reach us bracketed (`[::1]:3000`), which
 * `normalizeHostname` does not unwrap.
 */
function isPrivateAddress(hostname: string): boolean {
  const octets = hostname.split(".");
  if (octets.length !== 4) return false;

  const [a, b] = octets.map((part) =>
    /^\d{1,3}$/.test(part) ? Number(part) : NaN,
  ) as [number, number, number, number];
  if (Number.isNaN(a) || Number.isNaN(b) || a > 255 || b > 255) return false;

  return (
    a === 127 || // loopback
    a === 10 || // 10.0.0.0/8
    (a === 192 && b === 168) || // 192.168.0.0/16
    (a === 172 && b >= 16 && b <= 31) // 172.16.0.0/12
  );
}

export type PlatformHostOptions = {
  /**
   * Treat a loopback or private-network address as the platform host.
   *
   * OFF by default, and the caller must opt in per environment — never from
   * inside this module, which stays pure and dependency-free.
   *
   * This exists for physical devices in development. The Expo app on a phone
   * reaches the dev server at the machine's LAN address, so its `host` header is
   * `192.168.x.x:3000`. Without this, that hostname is not the platform, is not
   * a `.{rootDomain}` subdomain, and therefore falls through to `custom-domain`
   * — no tenant owns it, resolution returns `unknown`, and `proxy.ts` rewrites
   * every request to `/tenant-not-found`. The visible symptom is not an auth
   * error: it is each API call returning the not-found *page*, so the mobile
   * client gets HTML where it expects JSON and every screen renders empty.
   *
   * It must stay off in production. The platform branch is the one that carries
   * a Clerk session, so accepting an arbitrary unverified host there is exactly
   * the host-header confusion this classifier exists to prevent — and behind a
   * proxy, `host` is attacker-controlled.
   */
  allowPrivateHosts?: boolean;
};

/** Hostnames that are platform infrastructure, never a tenant. */
export function isPlatformHost(
  hostname: string,
  rootDomain: string,
  options: PlatformHostOptions = {},
): boolean {
  return (
    hostname === rootDomain ||
    hostname === `www.${rootDomain}` ||
    hostname === "localhost" ||
    hostname.endsWith(".vercel.app") ||
    hostname.endsWith(".ngrok.io") ||
    hostname.endsWith(".ngrok-free.app") ||
    (options.allowPrivateHosts === true && isPrivateAddress(hostname))
  );
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.toLowerCase());
}

/**
 * Tenant slugs are DNS labels: lowercase alphanumerics and hyphens, no leading
 * or trailing hyphen, 3–63 chars.
 */
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= 3 &&
    slug.length <= 63 &&
    SLUG_PATTERN.test(slug) &&
    !isReservedSlug(slug)
  );
}
