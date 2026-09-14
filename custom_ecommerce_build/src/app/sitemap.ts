import type { MetadataRoute } from 'next';

import ROUTES from '@/constant/routes';

/**
 * Platform-domain sitemap: the public marketing surface only.
 *
 * Tenant storefronts are deliberately absent. They live on their own hostnames
 * and a sitemap may only list URLs on the host that serves it, so each store
 * gets its own at `app/sites/[tenant]/sitemap.xml/route.ts`.
 *
 * `/dashboard` and the API are not here for the obvious reason, and `/sign-in`
 * is listed only because it is a legitimate public entry point people search
 * for by name.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com';
  const base = `https://${rootDomain}`;
  const lastModified = new Date();

  return [
    {
      url: `${base}${ROUTES.home}`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${base}${ROUTES.pricing}`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${base}${ROUTES.signIn}`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}${ROUTES.signUp}`,
      lastModified,
      changeFrequency: 'yearly',
      priority: 0.5,
    },
  ];
}
