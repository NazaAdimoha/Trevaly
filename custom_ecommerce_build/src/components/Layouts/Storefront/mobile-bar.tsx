'use client';

import { Home, Menu, Search, ShoppingBag, Store } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import type { StorefrontLayout } from '@core/storefront/layout';

import { cn } from '@/lib/cn';
import { useCart } from '@/lib/store/cart';
import { useStorefrontUi } from '@/lib/store/ui';

import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * Checkout is the one route the bar stays off.
 *
 * Two reasons, and the second is the one that actually breaks something. A
 * bottom bar offering Search and Menu while someone is paying is an exit put
 * under their thumb at the exact moment the shop wants none — and physically,
 * it is fixed over the bottom 56px of the viewport, which is where "Pay now"
 * sits on a phone. The chrome was covering the button it exists to lead to.
 */
export function hidesMobileBar(pathname: string): boolean {
  return pathname === STOREFRONT_ROUTES.checkout;
}

/**
 * The bar pinned to the bottom of a phone.
 *
 * Reaching a header at the top of a 6.7" screen means a hand adjustment; the
 * bottom of the screen is where a thumb already is. Every reference theme built
 * for mobile-first traffic does this, and ours is mobile-first traffic.
 */
export function MobileBar({ bar }: { bar: StorefrontLayout['mobileBar'] }) {
  const pathname = usePathname();
  const open = useStorefrontUi((s) => s.open);
  const items = useCart((s) => s.items);

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const count = items.reduce((total, item) => total + item.quantity, 0);

  // Orders are placed as a guest — there is no customer account to open yet, so
  // an account tab is dropped rather than rendered as a link to nowhere.
  const tabs = bar.items.filter((item) => item !== 'account');
  if (!bar.enabled || tabs.length === 0 || hidesMobileBar(pathname)) return null;

  const entries = tabs.map((item) => {
    switch (item) {
      case 'menu':
        return { key: item, label: 'Menu', icon: Menu, onClick: () => open('menu') };
      case 'search':
        return { key: item, label: 'Search', icon: Search, onClick: () => open('search') };
      case 'cart':
        return { key: item, label: 'Cart', icon: ShoppingBag, onClick: () => open('cart'), badge: true };
      case 'shop':
        return { key: item, label: 'Shop', icon: Store, href: STOREFRONT_ROUTES.home };
      case 'home':
      default:
        return { key: item, label: 'Home', icon: Home, href: STOREFRONT_ROUTES.home };
    }
  });

  return (
    <nav
      aria-label='Quick navigation'
      className='st-hairline fixed inset-x-0 bottom-0 z-40 border-t lg:hidden'
      style={{
        background: 'color-mix(in srgb, var(--st-bg) 94%, transparent)',
        backdropFilter: 'blur(10px)',
        // Above the home indicator on an iPhone, not under it.
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <ul className='flex'>
        {entries.map((entry) => {
          const Icon = entry.icon;
          const active = entry.href ? pathname === entry.href : false;
          const content = (
            <>
              <span className='relative'>
                <Icon className='size-5' />
                {entry.badge && mounted && count > 0 ? (
                  <span
                    className='absolute -top-1.5 -right-2 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold'
                    style={{ background: 'var(--st-accent)', color: 'var(--st-accent-ink)' }}
                  >
                    {count}
                  </span>
                ) : null}
              </span>
              <span className='text-[11px]'>{entry.label}</span>
            </>
          );

          return (
            <li key={entry.key} className='flex-1'>
              {entry.href ? (
                <Link
                  href={entry.href}
                  className={cn(
                    'flex min-h-[3.5rem] flex-col items-center justify-center gap-1',
                    !active && 'st-muted',
                  )}
                >
                  {content}
                </Link>
              ) : (
                <button
                  type='button'
                  onClick={entry.onClick}
                  className='st-muted flex min-h-[3.5rem] w-full flex-col items-center justify-center gap-1'
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
