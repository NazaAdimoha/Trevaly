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
 * SECURITY — `x-tenant-slug` is the identity that every tenant-scoped API route
 * trusts. Two rules, both non-negotiable:
 *
 *   1. An INBOUND `x-tenant-slug` is always hostile. It is deleted on every
 *      path, including the ones that never set a replacement. Skipping this on
 *      the platform branch is what would let anyone POST to
 *      `yourbrand.com/api/checkout` with a hand-set header and act as any store.
 *
 *   2. The value is set on the REQUEST headers via `NextResponse.next({
 *      request: { headers } })`. Setting it on the response (`res.headers.set`)
 *      does not reach the route handler at all.
 */

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'yourbrand.com';

const TENANT_HEADER = 'x-tenant-slug';

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

/** Always returns a fresh header set with any client-supplied tenant stripped. */
function sanitizedHeaders(req: NextRequest, slug?: string): Headers {
  const headers = new Headers(req.headers);
  headers.delete(TENANT_HEADER); // rule 1 — never trust an inbound value
  if (slug) headers.set(TENANT_HEADER, slug);
  return headers;
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
  '/api/stores(.*)',
  '/api/platform(.*)',
  // The mobile app's "which stores may I act for" call. Adding a route that
  // uses `auth()` without listing it here is a 500, not a 401 — which is
  // exactly how this one was caught.
  '/api/me(.*)',
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

  // Webhooks are provider-to-server: no tenant host, no auth, signature-verified
  // in the handler. Let them through untouched apart from header sanitising.
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next({ request: { headers: sanitizedHeaders(req) } });
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
    // Public platform routes never enter Clerk. See `isClerkRoute` above.
    if (!isClerkRoute(req)) {
      return NextResponse.next({ request: { headers: sanitizedHeaders(req) } });
    }
    return handlePlatform(req, event);
  }

  const { slug } = resolution;
  const headers = sanitizedHeaders(req, slug);

  // Storefront API calls share one set of handlers regardless of which store
  // called them — carry the tenant in the header, leave the path alone.
  if (pathname.startsWith('/api')) {
    return NextResponse.next({ request: { headers } });
  }

  // Storefront pages render through a single shared dynamic segment.
  return NextResponse.rewrite(
    new URL(`/sites/${slug}${pathname}${search}`, req.url),
    { request: { headers } },
  );
}
