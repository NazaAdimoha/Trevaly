import { notFound } from 'next/navigation';

import { tenantOrigin, tenantUrl } from '@/lib/domains/canonical';
import { tenantDb } from '@/lib/tenant-db';

import { resolveStorefrontTenant } from '@/app/sites/_tenant';

/**
 * Per-tenant `sitemap.xml`.
 *
 * Every URL is built from `tenantOrigin`, never from the request host: a
 * sitemap served on the subdomain but listing custom-domain URLs (or the
 * reverse) is rejected as cross-host, and mixing the two is exactly the
 * duplicate-content problem the canonical exists to solve.
 *
 * Queried through `tenantDb` and not `prisma`. This is the one endpoint whose
 * whole job is to publish a catalogue, so a scoping mistake here would hand one
 * business's product list to Google under another business's domain.
 */

/**
 * Not optional, and not a performance knob.
 *
 * Without it the build prerenders this handler once, against a placeholder
 * tenant segment (`/sites/-/sitemap.xml` in the route list), and every store
 * would then be served whichever catalogue that build happened to capture —
 * one tenant's entire product list published to Google under another tenant's
 * domain. The `s-maxage` header below is where caching belongs instead: the CDN
 * keys it on the real request URL, which is per-host.
 */
export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tenant: string }> },
) {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);

  if (!tenant) notFound();

  const db = tenantDb(tenant.id);

  // tenantId is injected by the wrapper — deliberately absent here.
  const [categories, products] = await Promise.all([
    db.category.findMany({
      where: { isActive: true },
      select: { slug: true },
      orderBy: { position: 'asc' },
      take: 200,
    }),
    db.product.findMany({
      where: { isActive: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
      take: 5000,
    }),
  ]);

  const now = new Date();
  const entries = [
    { loc: tenantOrigin(tenant), lastmod: now, priority: '1.0' },
    // Above products on purpose: a category is the broadest term a store will
    // rank for, and it is the page a crawler should reach the catalogue through.
    ...categories.map((category) => ({
      loc: tenantUrl(tenant, `/categories/${category.slug}`),
      lastmod: now,
      priority: '0.9',
    })),
    ...products.map((product) => ({
      loc: tenantUrl(tenant, `/products/${product.slug}`),
      lastmod: product.updatedAt,
      priority: '0.8',
    })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) =>
        `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod.toISOString()}</lastmod><priority>${entry.priority}</priority></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
}
