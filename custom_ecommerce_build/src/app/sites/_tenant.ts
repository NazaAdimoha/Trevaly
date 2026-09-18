import { cache } from 'react';

import type { StorefrontTheme, TenantStatus } from '@core/enums';
import { defaultLayout, type StorefrontLayout } from '@core/storefront/layout';
import { presetForTheme } from '@core/storefront/tokens';

import { apiGet, apiGetOrNull } from '@/lib/server-api';

/** A store's public branding and canonical fields, as the API returns them. */
export type StorefrontTenant = {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  logoPublicId: string | null;
  primaryColor: string | null;
  tagline: string | null;
  theme: StorefrontTheme;
  contactEmail: string | null;
  whatsappNumber: string | null;
  currency: string;
  // Not branding — these decide the canonical host and the structured data.
  // Stripped before the tenant reaches the client provider in
  // `app/sites/[tenant]/layout.tsx`.
  customDomain: string | null;
  customDomainVerified: boolean;
  storeAddress: string | null;
};

/** One storefront product with its variants. Dates arrive as ISO strings. */
export type StorefrontProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  imageUrls: string[];
  isActive: boolean;
  optionName: string | null;
  categoryId: string | null;
  variants: Array<{
    id: string;
    value: string;
    sku: string | null;
    priceKobo: number | null;
    stock: number;
    isActive: boolean;
    position: number;
  }>;
};

/**
 * One product plus what the detail page needs around it: the collection it
 * belongs to (for breadcrumbs) and what else is in that collection.
 *
 * `related` comes back from the same API call rather than a second one — a
 * "pairs well with" row that costs an extra round trip is a row that gets cut
 * the first time the page feels slow.
 */
export type StorefrontProductDetail = StorefrontProduct & {
  category: { name: string; slug: string } | null;
  related: StorefrontProduct[];
};

export type StorefrontCatalog = {
  category: { id: string; name: string; slug: string } | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  products: StorefrontProduct[];
  /** Matches before the limit, so a collection page can say "48 items". */
  total: number;
};

/** How a collection page is currently narrowed and ordered. */
export type CatalogQuery = {
  category?: string;
  sort?: 'newest' | 'price-asc' | 'price-desc' | 'name';
  inStock?: boolean;
  limit?: number;
};

const path = (slug: string, rest = '') => `/storefront/${encodeURIComponent(slug)}${rest}`;

/**
 * Resolves a storefront tenant from the URL segment that `proxy.ts` rewrote in.
 *
 * Wrapped in React's `cache` so a page and its `generateMetadata` share one
 * API call per request rather than two — that doubling is easy to miss and
 * lands on every storefront page view.
 *
 * Reads the URL segment, never a header: a page must not be able to render
 * another tenant's data even if header handling is ever bypassed. A suspended
 * store is a 404 from the API, so it resolves to null here.
 */
export const resolveStorefrontTenant = cache((slug: string) =>
  apiGetOrNull<StorefrontTenant>(path(slug)),
);

/**
 * Categories plus the store's active products, narrowed and ordered by the API.
 *
 * Sorting and the in-stock filter are the API's job, not the page's: filtering
 * a 60-product slice in the browser would quietly drop the 61st match, and
 * "price, low to high" over a partial page is simply the wrong answer.
 *
 * The query is serialised in a FIXED order so React's `cache` sees one key per
 * distinct query — `?sort=name&category=bags` and `?category=bags&sort=name`
 * would otherwise be two cache entries and two calls for one page.
 */
function catalogPath(slug: string, query: CatalogQuery): string {
  const params = new URLSearchParams();
  if (query.category) params.set('category', query.category);
  if (query.sort && query.sort !== 'newest') params.set('sort', query.sort);
  if (query.inStock) params.set('inStock', 'true');
  if (query.limit) params.set('limit', String(query.limit));
  const search = params.toString();
  return path(slug, search ? `/catalog?${search}` : '/catalog');
}

export const getStorefrontCatalog = cache(
  (slug: string, query: CatalogQuery = {}) =>
    apiGetOrNull<StorefrontCatalog>(catalogPath(slug, query)),
);

export const getStorefrontProduct = cache((slug: string, productSlug: string) =>
  apiGetOrNull<StorefrontProductDetail>(
    path(slug, `/products/${encodeURIComponent(productSlug)}`),
  ),
);

/**
 * How this store is designed: preset, token overrides, and the sections of each
 * page. Cached per request — the root layout and the page beneath it both need
 * it, and that must cost one call.
 *
 * A failed lookup falls back to the preset the store's theme implies rather
 * than throwing. A design service having a bad minute must not take a shop
 * offline; it should cost that request its custom arrangement, nothing more.
 */
export const getStorefrontLayout = cache(
  async (slug: string, theme: StorefrontTheme | null): Promise<StorefrontLayout> => {
    const response = await apiGetOrNull<{ layout: StorefrontLayout }>(path(slug, '/layout'));
    return response?.layout ?? defaultLayout(presetForTheme(theme));
  },
);

export { apiGet, path as storefrontApiPath };
