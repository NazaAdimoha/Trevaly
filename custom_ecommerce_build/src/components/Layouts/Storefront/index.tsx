'use client';

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import type { StorefrontLayout } from '@core/storefront/layout';

import { useCart } from '@/lib/store/cart';
import { useTenant } from '@/lib/tenant-context';

import { storefrontStyle } from '@/constant/storefront-themes';

import { AnnouncementBar } from './announcement-bar';
import { CartDrawer } from './cart-drawer';
import { StorefrontFooter } from './footer';
import { type NavItem,StorefrontHeader } from './header';
import { hidesMobileBar,MobileBar } from './mobile-bar';
import { MobileMenu } from './mobile-menu';
import { SearchOverlay } from './search-overlay';

/**
 * Public storefront shell.
 *
 * The store's whole design arrives as CSS custom properties on this one
 * element, so a single stylesheet serves every store on every preset — no
 * per-tenant CSS bundle, and no per-preset one either.
 *
 * `design` and `chrome` come from the published layout, resolved on the server,
 * so the first paint is already the merchant's palette and their navigation
 * rather than a default that swaps a moment later.
 */
export default function StorefrontShell({
  children,
  design,
  chrome,
  nav,
  suggestions,
}: {
  children: ReactNode;
  design?: Pick<StorefrontLayout, 'preset' | 'tokens'>;
  chrome: Pick<StorefrontLayout, 'announcement' | 'header' | 'footer' | 'mobileBar'>;
  nav: NavItem[];
  /** Products offered in an empty cart and in search — never a dead end. */
  suggestions: { name: string; slug: string; imageUrl: string | null }[];
}) {
  const tenant = useTenant();
  const setTenant = useCart((s) => s.setTenant);
  const pathname = usePathname();

  // Scope the persisted cart to this store, so two storefronts open in the same
  // browser cannot contaminate each other.
  useEffect(() => {
    setTenant(tenant.slug);
  }, [tenant.slug, setTenant]);

  return (
    <div
      className='st-root flex min-h-screen flex-col'
      style={storefrontStyle(design ?? null, tenant.theme, tenant.primaryColor)}
    >
      <AnnouncementBar announcement={chrome.announcement} storeSlug={tenant.slug} />

      <StorefrontHeader
        header={chrome.header}
        nav={nav}
        announcementOffset={chrome.announcement.enabled}
      />

      <main className='flex-1'>{children}</main>

      <StorefrontFooter footer={chrome.footer} />

      {/* Room for the bottom bar, so a footer link is never underneath it. The
          spacer has to follow the bar's own visibility or checkout gains 56px
          of dead space at the end of the page. */}
      {chrome.mobileBar.enabled && !hidesMobileBar(pathname) ? (
        <div className='h-14 lg:hidden' aria-hidden />
      ) : null}

      <MobileBar bar={chrome.mobileBar} />
      <CartDrawer
        freeShippingThresholdKobo={chrome.announcement.freeShippingThresholdKobo}
        suggestions={suggestions}
      />
      <MobileMenu nav={nav} />
      <SearchOverlay suggestions={suggestions} />
    </div>
  );
}
