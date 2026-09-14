import { notFound } from 'next/navigation';

import { tenantOrigin } from '@/lib/domains/canonical';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

/**
 * Per-tenant `robots.txt`.
 *
 * A Route Handler rather than a `robots.ts` metadata file: the metadata
 * conventions are documented for the root of `app`, and this has to live under
 * a dynamic segment that `proxy.ts` rewrites into. A handler is unambiguous
 * about the path it serves.
 *
 * `shop.yourbrand.com/robots.txt` -> rewritten to
 * `/sites/shop/robots.txt` -> here.
 */
/** Per-tenant output must never be captured at build time — see the sitemap. */
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);

  if (!tenant) notFound();

  const origin = tenantOrigin(tenant);

  const body = [
    'User-agent: *',
    'Allow: /',
    // Nothing behind these is content, and `/order/` is customer data.
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /order/',
    'Disallow: /api/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
