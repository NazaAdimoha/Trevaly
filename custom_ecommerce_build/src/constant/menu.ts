import ROUTES from '@/constant/routes';

/**
 * Sidebar definitions.
 *
 * `icon` is a *name*, not a component. These menus are built in Server
 * Components and handed to the client sidebar, and only plain data survives
 * that boundary — passing a Lucide component directly throws
 * "Only plain objects can be passed to Client Components". The name is mapped
 * back to a component in `NavMain`, which is a client component and can hold
 * the reference.
 *
 * Keeping this module free of JSX and of `lucide-react` also means a Server
 * Component importing it does not drag an icon library into its graph.
 */
export type NavIcon =
  | 'overview'
  | 'products'
  | 'orders'
  | 'coupons'
  | 'delivery'
  | 'settings'
  | 'tenants'
  | 'webhooks';

export type NavItem = {
  title: string;
  url: string;
  icon: NavIcon;
  /** First path segment after the store slug, used for active-state matching. */
  key: string;
};

/**
 * Sidebar for one store's admin.
 *
 * Slug-parameterised rather than static: a user may administer several stores,
 * and the URL is the single source of truth for which one is in scope.
 */
export function storeMenu(slug: string): NavItem[] {
  return [
    {
      title: 'Overview',
      url: ROUTES.store.base(slug),
      icon: 'overview',
      key: '',
    },
    {
      title: 'Products',
      url: ROUTES.store.products.base(slug),
      icon: 'products',
      key: 'products',
    },
    {
      title: 'Orders',
      url: ROUTES.store.orders.base(slug),
      icon: 'orders',
      key: 'orders',
    },
    {
      title: 'Coupons',
      url: ROUTES.store.coupons.base(slug),
      icon: 'coupons',
      key: 'coupons',
    },
    {
      title: 'Delivery Zones',
      url: ROUTES.store.deliveryZones.base(slug),
      icon: 'delivery',
      key: 'delivery-zones',
    },
    {
      title: 'Settings',
      url: ROUTES.store.settings.base(slug),
      icon: 'settings',
      key: 'settings',
    },
  ];
}

/** Platform operator sidebar — your own team only. */
export const platformMenu: NavItem[] = [
  {
    title: 'Tenants',
    url: ROUTES.platform.tenants.base,
    icon: 'tenants',
    key: 'tenants',
  },
  {
    title: 'Webhook Events',
    url: ROUTES.platform.webhookEvents,
    icon: 'webhooks',
    key: 'webhook-events',
  },
];
