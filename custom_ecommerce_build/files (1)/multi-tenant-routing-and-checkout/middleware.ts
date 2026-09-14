import { NextRequest, NextResponse } from 'next/server';

// The domain your platform sells subdomains under, e.g. "yourbrand.com"
// -> a tenant's storefront lives at "{slug}.yourbrand.com"
const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? 'yourbrand.com';

// Skip static assets entirely. API routes ARE matched — they need the
// tenant header too, they just don't get path-rewritten (see below).
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const hostname = (req.headers.get('host') ?? '')
    .replace(':3000', '')
    .replace(':443', '');

  // Root domain / www -> your own marketing site, not a tenant storefront.
  if (hostname === ROOT_DOMAIN || hostname === `www.${ROOT_DOMAIN}`) {
    return NextResponse.next();
  }

  const tenantSlug = hostname.endsWith(`.${ROOT_DOMAIN}`)
    ? hostname.replace(`.${ROOT_DOMAIN}`, '')
    : await resolveCustomDomain(hostname, req);

  if (!tenantSlug) {
    return NextResponse.rewrite(new URL('/tenant-not-found', req.url));
  }

  // API routes: attach the tenant header, don't rewrite the path — route
  // handlers live at a shared /api/** path regardless of which storefront
  // called them.
  if (url.pathname.startsWith('/api')) {
    const res = NextResponse.next();
    res.headers.set('x-tenant-slug', tenantSlug);
    return res;
  }

  // Page routes: rewrite into a single shared dynamic segment so one
  // codebase renders every tenant's storefront.
  const rewrittenUrl = new URL(
    `/_sites/${tenantSlug}${url.pathname}${url.search}`,
    req.url,
  );
  const res = NextResponse.rewrite(rewrittenUrl);
  res.headers.set('x-tenant-slug', tenantSlug);
  return res;
}

// Subdomains resolve to a slug with zero lookups (it's literally in the
// hostname). Custom domains need a DB lookup — but middleware runs on the
// Edge runtime, so we go through a cached Route Handler instead of calling
// Prisma directly here.
async function resolveCustomDomain(
  hostname: string,
  req: NextRequest,
): Promise<string | null> {
  try {
    const lookup = await fetch(
      new URL('/api/internal/resolve-domain', req.url),
      {
        headers: { 'x-lookup-host': hostname },
        next: { revalidate: 300 }, // cache the mapping at the edge for 5 minutes
      },
    );
    if (!lookup.ok) return null;
    const data = (await lookup.json()) as { slug: string | null };
    return data.slug;
  } catch {
    return null;
  }
}
