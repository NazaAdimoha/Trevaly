import {
  isPlatformHost,
  isReservedSlug,
  type PlatformHostOptions,
} from "./reserved";

/**
 * Pure hostname parsing. Deliberately free of any database import so it can be
 * unit-tested and used from edge-ish contexts without pulling in Prisma.
 * The database half lives in `./resolve`.
 */

/** Strip the port and normalise case. `Example.com:3000` -> `example.com`. */
export function normalizeHostname(host: string | null | undefined): string {
  if (!host) return "";
  const [hostname] = host.split(":");
  return (hostname ?? "").toLowerCase().trim();
}

export type HostnameKind =
  | { kind: "platform" }
  | { kind: "subdomain"; slug: string }
  | { kind: "custom-domain"; hostname: string }
  | { kind: "unknown" };

/**
 * Classify a hostname without touching the database.
 *
 * Subdomains resolve with zero lookups — the slug is literally in the hostname.
 * Only a custom domain needs a lookup, which the caller performs.
 */
export function classifyHostname(
  host: string | null | undefined,
  rootDomain: string,
  options: PlatformHostOptions = {},
): HostnameKind {
  const hostname = normalizeHostname(host);
  if (!hostname) return { kind: "unknown" };

  if (isPlatformHost(hostname, rootDomain, options)) return { kind: "platform" };

  const suffix = `.${rootDomain}`;
  const isLocalDev = hostname.endsWith(".localhost");

  if (hostname.endsWith(suffix) || isLocalDev) {
    const slug = isLocalDev
      ? hostname.slice(0, -".localhost".length)
      : hostname.slice(0, -suffix.length);

    // Multi-level subdomains ("a.b.yourbrand.com") are never tenants.
    if (!slug || slug.includes(".")) return { kind: "unknown" };
    if (isReservedSlug(slug)) return { kind: "platform" };

    return { kind: "subdomain", slug };
  }

  return { kind: "custom-domain", hostname };
}
