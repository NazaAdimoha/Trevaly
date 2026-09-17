import { cache } from 'react';

import type { StorefrontTheme, TenantStatus } from '@core/enums';

import { apiGetOrNull } from '@/lib/server-api';

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

export type StorefrontCatalog = {
  category: { id: string; name: string; slug: string } | null;
  categories: Array<{ id: string; name: string; slug: string }>;
  products: StorefrontProduct[];
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

/** Categories plus up to 60 active products; one category's when given. */
export const getStorefrontCatalog = cache((slug: string, categorySlug?: string) =>
  apiGetOrNull<StorefrontCatalog>(
    path(slug, categorySlug ? `/catalog?category=${encodeURIComponent(categorySlug)}` : '/catalog'),
  ),
);

export const getStorefrontProduct = cache((slug: string, productSlug: string) =>
  apiGetOrNull<StorefrontProduct>(path(slug, `/products/${encodeURIComponent(productSlug)}`)),
);

export { path as storefrontApiPath };
