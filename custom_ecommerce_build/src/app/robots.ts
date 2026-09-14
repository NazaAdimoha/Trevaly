import type { MetadataRoute } from 'next';

/**
 * Platform-domain robots.
 *
 * The preview-deploy guard is the important half. Vercel gives every branch a
 * public `*.vercel.app` URL serving the same application; indexed, those
 * compete with the real domain for our own terms and can outrank it. Anything
 * that is not a production deployment refuses crawling outright.
 *
 * Tenant storefronts do NOT use this file — they are on their own hostnames and
 * are served by `app/sites/[tenant]/robots.txt/route.ts`.
 */
export default function robots(): MetadataRoute.Robots {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com';
  const isProduction = process.env.VERCEL_ENV
    ? process.env.VERCEL_ENV === 'production'
    : process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // `/sites/**` is the internal rewrite target for storefronts and is
      // already rejected by proxy.ts; listing it keeps a crawler from
      // discovering it through a stray link.
      disallow: ['/api/', '/dashboard/', '/sites/'],
    },
    sitemap: `https://${rootDomain}/sitemap.xml`,
  };
}
