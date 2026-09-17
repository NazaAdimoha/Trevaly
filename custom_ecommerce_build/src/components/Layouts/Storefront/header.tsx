'use client';

import { Menu, Search, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { cloudinaryUrl } from '@core/media/folder';
import type { StorefrontLayout } from '@core/storefront/layout';

import { cn } from '@/lib/cn';
import { useCart } from '@/lib/store/cart';
import { useStorefrontUi } from '@/lib/store/ui';
import { useTenant } from '@/lib/tenant-context';

import { STOREFRONT_ROUTES } from '@/constant/routes';

export type NavItem = {
  label: string;
  href: string;
  children: { label: string; href: string; image?: string | null }[];
};

/**
 * The storefront header.
 *
 * Three layouts, one component. `floating` is the pill that sits over a hero
 * and detaches from the top of the page; `centred` puts the wordmark in the
 * middle with the navigation split beneath; `classic` is wordmark left,
 * navigation beside it. A shopper looks for the cart in the same place in all
 * three, which is why that one position never moves.
 *
 * Before this, a store had no navigation at all — a logo and a cart icon. A
 * catalogue with no way through it is the single biggest reason ours read as a
 * demo next to a real shop.
 */
export function StorefrontHeader({
  header,
  nav,
  announcementOffset,
}: {
  header: StorefrontLayout['header'];
  nav: NavItem[];
  /** Whether an announcement bar sits above, for the floating layout's offset. */
  announcementOffset: boolean;
}) {
  const tenant = useTenant();
  const open = useStorefrontUi((s) => s.open);
  const items = useCart((s) => s.items);
  const [scrolled, setScrolled] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // The cart count differs between server and first client render because it
  // lives in localStorage. `useSyncExternalStore` hands over the server
  // snapshot during hydration and the client one after.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const count = items.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    // `transparentOverHero` only means anything at the top of the page: once a
    // shopper scrolls, the header needs its own background or it sits on top of
    // product photography and becomes unreadable.
    if (!header.transparentOverHero) return;
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [header.transparentOverHero]);

  const transparent = header.transparentOverHero && !scrolled;
  const floating = header.layout === 'floating';
  const centred = header.layout === 'centred';

  const logoSrc = cloudinaryUrl(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    tenant.logoPublicId,
    { width: 320 },
  );

  const wordmark = (
    <Link
      href={STOREFRONT_ROUTES.home}
      className='flex items-center gap-2'
      aria-label={tenant.name}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- a Cloudinary delivery URL already sized by the theme's logo height
        <img
          src={logoSrc}
          alt={tenant.name}
          className='w-auto'
          style={{ height: 'var(--st-logo-height)' }}
        />
      ) : (
        <span
          className='st-display'
          style={{ fontSize: 'calc(var(--st-logo-height) * 0.62)' }}
        >
          {tenant.name}
        </span>
      )}
    </Link>
  );

  const actions = (
    <div className='flex items-center gap-1'>
      {header.showSearch ? (
        <button
          type='button'
          onClick={() => open('search')}
          aria-label='Search'
          className='st-control p-2 transition-opacity hover:opacity-60'
        >
          <Search className='size-5' />
        </button>
      ) : null}

      <button
        type='button'
        onClick={() => open('cart')}
        className='st-control relative p-2 transition-opacity hover:opacity-60'
        aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
      >
        <ShoppingBag className='size-5' />
        {mounted && count > 0 ? (
          <span
            className='absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold'
            style={{ background: 'var(--st-accent)', color: 'var(--st-accent-ink)' }}
          >
            {count}
          </span>
        ) : null}
      </button>
    </div>
  );

  return (
    <header
      className={cn(
        'z-40 w-full',
        header.sticky && 'sticky top-0',
        floating && 'px-3 pt-3',
        // The floating pill overlays the hero; the others push it down.
        floating && header.transparentOverHero && 'absolute inset-x-0',
        floating && header.transparentOverHero && announcementOffset && 'top-auto',
      )}
      // Colours come from the store's own tokens, so a dark preset gets a dark
      // header without a second component.
      style={
        transparent
          ? { color: '#FFFFFF' }
          : { color: 'var(--st-ink)' }
      }
      onMouseLeave={() => setOpenMenu(null)}
    >
      <div
        className={cn(
          'transition-[background-color,box-shadow,backdrop-filter] duration-300',
          floating ? 'st-container' : '',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-4',
            floating ? 'px-5 py-3' : 'st-container py-4',
            !floating && !transparent && 'st-hairline border-b',
          )}
          style={{
            borderRadius: floating ? 'var(--st-radius-control)' : undefined,
            background: transparent
              ? 'transparent'
              : floating
                ? 'var(--st-bg)'
                : 'color-mix(in srgb, var(--st-bg) 92%, transparent)',
            backdropFilter: transparent ? undefined : 'blur(8px)',
            boxShadow: floating && !transparent ? '0 8px 30px rgba(0,0,0,0.08)' : undefined,
          }}
        >
          <button
            type='button'
            onClick={() => open('menu')}
            aria-label='Menu'
            className='st-control p-2 transition-opacity hover:opacity-60 lg:hidden'
          >
            <Menu className='size-5' />
          </button>

          {centred ? (
            <>
              <nav className='hidden flex-1 items-center gap-6 lg:flex'>
                {nav.slice(0, 3).map((item) => (
                  <NavLink
                    key={item.href + item.label}
                    item={item}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                  />
                ))}
              </nav>
              <div className='flex flex-1 justify-center lg:flex-none'>{wordmark}</div>
              <div className='flex flex-1 items-center justify-end gap-6'>
                <nav className='hidden items-center gap-6 lg:flex'>
                  {nav.slice(3, 6).map((item) => (
                    <NavLink
                      key={item.href + item.label}
                      item={item}
                      openMenu={openMenu}
                      setOpenMenu={setOpenMenu}
                    />
                  ))}
                </nav>
                {actions}
              </div>
            </>
          ) : (
            <>
              {wordmark}
              <nav className='hidden flex-1 items-center gap-6 lg:flex'>
                {nav.map((item) => (
                  <NavLink
                    key={item.href + item.label}
                    item={item}
                    openMenu={openMenu}
                    setOpenMenu={setOpenMenu}
                  />
                ))}
              </nav>
              <div className='ml-auto'>{actions}</div>
            </>
          )}
        </div>
      </div>

      {/* The mega panel is a sibling of the bar, not a child of the link, so it
          can span the full width without the link's stacking context. */}
      {nav.map((item) =>
        openMenu === item.label && item.children.length > 0 ? (
          <MegaMenu key={item.label} item={item} onNavigate={() => setOpenMenu(null)} />
        ) : null,
      )}
    </header>
  );
}

function NavLink({
  item,
  openMenu,
  setOpenMenu,
}: {
  item: NavItem;
  openMenu: string | null;
  setOpenMenu: (label: string | null) => void;
}) {
  const hasChildren = item.children.length > 0;

  return (
    <Link
      href={item.href}
      className='st-display relative py-2 text-sm transition-opacity hover:opacity-60'
      aria-expanded={hasChildren ? openMenu === item.label : undefined}
      onMouseEnter={() => setOpenMenu(hasChildren ? item.label : null)}
      // Keyboard users get the panel too: focus opens it, which is the only way
      // a mega menu is reachable without a mouse.
      onFocus={() => setOpenMenu(hasChildren ? item.label : null)}
    >
      {item.label}
    </Link>
  );
}

function MegaMenu({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const withImages = item.children.filter((child) => child.image);

  return (
    <div
      className='st-hairline absolute inset-x-0 hidden border-t border-b shadow-lg lg:block'
      style={{ background: 'var(--st-bg)', color: 'var(--st-ink)' }}
    >
      <div className='st-container grid grid-cols-4 gap-8 py-8'>
        <ul className='col-span-2 grid grid-cols-2 gap-x-8 gap-y-2'>
          {item.children.map((child) => (
            <li key={child.href + child.label}>
              <Link
                href={child.href}
                onClick={onNavigate}
                className='block py-1.5 text-sm transition-opacity hover:opacity-60'
              >
                {child.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Promo imagery, when the merchant gave any. A menu with a picture in
            it is the difference between a list and a shop window. */}
        {withImages.slice(0, 2).map((child) => {
          const src = cloudinaryUrl(
            process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            child.image,
            { width: 600, height: 400, crop: 'fill' },
          );
          return (
            <Link
              key={`promo-${child.href}`}
              href={child.href}
              onClick={onNavigate}
              className='group block'
            >
              <span className='st-media block aspect-[3/2]'>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                  <img
                    src={src}
                    alt=''
                    className='size-full object-cover transition-transform duration-500 group-hover:scale-105'
                    loading='lazy'
                  />
                ) : null}
              </span>
              <span className='st-display mt-2 block text-sm'>{child.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
