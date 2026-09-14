/**
 * Single source of truth for platform + dashboard paths.
 * Never hardcode a dashboard URL in a component when a constant exists here.
 *
 * Storefront URLs are NOT listed here — they are resolved from the hostname by
 * `src/proxy.ts` and are always root-relative within a tenant's own domain
 * (see `STOREFRONT_ROUTES` at the bottom).
 */
const ROUTES = {
  home: '/',
  pricing: '/pricing',
  signIn: '/sign-in',
  signUp: '/sign-up',
  unauthorized: '/dashboard/unauthorized',
  tenantNotFound: '/tenant-not-found',

  dashboard: {
    base: '/dashboard',
  },

  /** A single tenant's admin surface, always keyed by store slug. */
  store: {
    base: (slug: string) => `/dashboard/stores/${slug}`,

    products: {
      base: (slug: string) => `/dashboard/stores/${slug}/products`,
      create: (slug: string) => `/dashboard/stores/${slug}/products/create`,
      import: (slug: string) => `/dashboard/stores/${slug}/products/import`,
      detail: (slug: string, id: string) =>
        `/dashboard/stores/${slug}/products/${id}`,
      edit: (slug: string, id: string) =>
        `/dashboard/stores/${slug}/products/${id}/edit`,
    },

    orders: {
      base: (slug: string) => `/dashboard/stores/${slug}/orders`,
      detail: (slug: string, id: string) =>
        `/dashboard/stores/${slug}/orders/${id}`,
    },

    coupons: {
      base: (slug: string) => `/dashboard/stores/${slug}/coupons`,
      create: (slug: string) => `/dashboard/stores/${slug}/coupons/create`,
    },

    deliveryZones: {
      base: (slug: string) => `/dashboard/stores/${slug}/delivery-zones`,
    },

    settings: {
      base: (slug: string) => `/dashboard/stores/${slug}/settings`,
    },
  },

  /** Platform operator surface — your own team only. */
  platform: {
    base: '/dashboard/platform',
    tenants: {
      base: '/dashboard/platform/tenants',
      create: '/dashboard/platform/tenants/create',
      detail: (id: string) => `/dashboard/platform/tenants/${id}`,
    },
    webhookEvents: '/dashboard/platform/webhook-events',
  },
} as const;

/** Paths within a tenant storefront, relative to that store's own hostname. */
export const STOREFRONT_ROUTES = {
  home: '/',
  product: (slug: string) => `/products/${slug}`,
  category: (slug: string) => `/categories/${slug}`,
  cart: '/cart',
  checkout: '/checkout',
  order: (reference: string) => `/order/${reference}`,
} as const;

export default ROUTES;
