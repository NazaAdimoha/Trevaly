import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextFetchEvent, NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { resolveHostname } from '@/lib/domains/resolve';

/**
 * Tenant routing. (Next.js 16 renamed `middleware.ts` -> `proxy.ts`; it now
 * runs on the Node.js runtime, which is why tenant resolution can query the
 * database directly instead of round-tripping through an internal API route.)
 *
 * Three kinds of host reach this file:
 *
 *   yourbrand.com            -> marketing site + tenant dashboard (Clerk)
 *   {slug}.yourbrand.com     -> tenant storefront, public, no auth
 *   adaobistore.com          -> same storefront via a custom domain
 *
 * EVERY `/api/*` request is forwarded to the NestJS API (`API_ORIGIN`). This
 * app has no route handlers of its own and no database. Storefront calls get
 * the store's slug placed in the PATH (`/api/checkout` on a store's host becomes
 * `/api/storefront/{slug}/checkout`), so the API never has to trust a header to
 * know which store it is serving.
 *
 * SECURITY — three headers are proxy-only, and an INBOUND copy of any of them
 * is always hostile, so all three are deleted on every path:
 *
 *   x-tenant-slug    set for storefront page rewrites
 *   x-internal-key   proves to the API that a request came through here
 *   x-client-ip      the shopper's IP, which the API trusts only alongside
 *                    the internal key (otherwise every shopper would share one
 *                    rate-limit bucket: the proxy's)
 *
 * Headers are set on the REQUEST via `{ request: { headers } }`. Setting them
 * on the response never reaches the destination.
 */

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'yourbrand.com';

const TENANT_HEADER = 'x-tenant-slug';
const PROXY_ONLY_HEADERS = [TENANT_HEADER, 'x-internal-key', 'x-client-ip'];

export const config = {
  matcher: [
    // Everything except static assets and image optimisation.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)',
    // Clerk's auto-proxy path. Covered by the pattern above, but named
    // explicitly so a future narrowing of that regex cannot silently break the
    // handshake — the failure would surface as an unexplained sign-in loop.
    '/__clerk/:path*',
  ],
};

/** A fresh header set with every proxy-only header a client sent stripped. */
function sanitizedHeaders(req: NextRequest, slug?: string): Headers {
  const headers = new Headers(req.headers);
  for (const name of PROXY_ONLY_HEADERS) headers.delete(name); // never trust inbound
  if (slug) headers.set(TENANT_HEADER, slug);
  return headers;
}

/**
 * Hand a request to the API.
 *
 * `x-forwarded-host` is the host the shopper is actually on: the API needs it
 * to send them back to the right storefront after payment, and accepts it only
 * when it is that store's own address.
 */
function forwardToApi(req: NextRequest, apiPath: string): NextResponse {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    return NextResponse.json({ error: 'API is not configured' }, { status: 503 });
  }

  const headers = sanitizedHeaders(req);
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientIp = forwardedFor || req.headers.get('x-real-ip') || '';
  const internalKey = process.env.INTERNAL_API_KEY;
  if (internalKey) {
    headers.set('x-internal-key', internalKey);
    if (clientIp) headers.set('x-client-ip', clientIp);
  }
  headers.set('x-forwarded-host', req.headers.get('host') ?? '');
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  return NextResponse.rewrite(
    new URL(`${apiPath}${req.nextUrl.search}`, origin),
    { request: { headers } },
  );
}

/** A storefront host's `/api/*` path, with the store's slug moved into it. */
function storefrontApiPath(slug: string, pathname: string): string {
  const store = `/api/storefront/${encodeURIComponent(slug)}`;
  if (pathname === '/api/checkout') return `${store}/checkout`;
  if (pathname === '/api/coupons/preview') return `${store}/coupons/preview`;
  // Payment verification is addressed by reference, not by store.
  return pathname;
}

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

/**
 * Routes that actually need a Clerk session — i.e. anything that calls `auth()`,
 * directly or through `@/lib/auth` / `@/lib/auth-api`. Everything else on the
 * platform host (the marketing site, `/pricing`, `/tenant-not-found`, the public
 * storefront APIs) is served without Clerk in the request path at all.
 *
 * This list is not an optimisation — it is a correctness fix. On a DEVELOPMENT
 * Clerk instance, `clerkMiddleware` answers the first document request that has
 * no `__clerk_db_jwt` cookie with a 307 to
 * `<instance>.clerk.accounts.dev/v1/client/handshake?...&__clerk_hs_reason=dev-browser-missing`.
 * With the marketing home inside the matcher, that bounce happened on the very
 * first page every visitor lands on. Narrowing the matcher means the handshake
 * only ever occurs on the way into `/sign-in` or `/dashboard`, where a session
 * is genuinely being established.
 *
 * Keep this in sync when adding a route that calls `auth()`. A route missing
 * from here fails closed — `auth()` throws rather than silently returning null.
 */
const isClerkRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  // No `/api` entries: API requests are forwarded before this matcher runs,
  // and the API verifies the session itself (Bearer token or cookie).
  '/__clerk(.*)',
]);

/**
 * Clerk only wraps platform traffic. Storefronts are public and must not pay
 * the latency of an auth check on every product page view.
 */
const handlePlatform = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  return NextResponse.next({ request: { headers: sanitizedHeaders(req) } });
});

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;

  // Internal API routes are for this proxy's own server-side calls. Every
  // request forwarded below is stamped with the internal key, so forwarding
  // these would hand the key's authority to anyone on the internet.
  if (pathname.startsWith('/api/internal')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Webhooks are provider-to-server: no tenant host, no auth here, the
  // signature is verified by the API over the exact bytes forwarded.
  if (pathname.startsWith('/api/webhooks')) {
    return forwardToApi(req, pathname);
  }

  // The scheduler still calls the old path; the job lives at /api/jobs.
  if (pathname === '/api/cron/expire-orders') {
    return forwardToApi(req, '/api/jobs/expire-orders');
  }

  // `/sites/**` is the internal rewrite target, never a public URL. Without
  // this, yourbrand.com/sites/adaobi-store renders a storefront off the wrong
  // host — and any tenant's storefront off the platform domain.
  if (pathname.startsWith('/sites')) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url), {
      request: { headers: sanitizedHeaders(req) },
    });
  }

  const resolution = await resolveHostname(
    req.headers.get('host'),
    ROOT_DOMAIN,
  );

  if (resolution.kind === 'unknown') {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url), {
      request: { headers: sanitizedHeaders(req) },
    });
  }

  if (resolution.kind === 'platform') {
    if (pathname.startsWith('/api')) {
      return forwardToApi(req, pathname);
    }
    // Public platform routes never enter Clerk. See `isClerkRoute` above.
    if (!isClerkRoute(req)) {
      return NextResponse.next({ request: { headers: sanitizedHeaders(req) } });
    }
    return handlePlatform(req, event);
  }

  const { slug } = resolution;

  if (pathname.startsWith('/api')) {
    return forwardToApi(req, storefrontApiPath(slug, pathname));
  }

  const headers = sanitizedHeaders(req, slug);

  // Storefront pages render through a single shared dynamic segment.
  return NextResponse.rewrite(
    new URL(`/sites/${slug}${pathname}${search}`, req.url),
    { request: { headers } },
  );
}
