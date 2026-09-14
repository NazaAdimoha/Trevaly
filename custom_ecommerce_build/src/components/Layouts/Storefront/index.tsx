'use client';

import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';

import { cloudinaryUrl } from '@core/media/folder';

import { useCart } from '@/lib/store/cart';
import { useTenant } from '@/lib/tenant-context';
import { cn } from '@/lib/utils';

import { STOREFRONT_ROUTES } from '@/constant/routes';
import { themeConfig, themeStyle } from '@/constant/storefront-themes';

/**
 * Public storefront shell.
 *
 * Both the tenant's colour and its theme arrive as CSS custom properties on
 * this one element, so a single stylesheet serves every store on every theme —
 * no per-tenant CSS bundle, and no per-theme one either.
 */
export default function StorefrontShell({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  const items = useCart((s) => s.items);
  const setTenant = useCart((s) => s.setTenant);

  // Scope the persisted cart to this store, so two storefronts open in the same
  // browser cannot contaminate each other.
  useEffect(() => {
    setTenant(tenant.slug);
  }, [tenant.slug, setTenant]);

  // The cart lives in localStorage, so its count differs between server and
  // first client render. `useSyncExternalStore` returns the server snapshot
  // during hydration and the client one after — no setState in an effect, which
  // React 19 flags as a cascading render.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const count = items.reduce((total, item) => total + item.quantity, 0);
  const theme = themeConfig(tenant.theme);
  const centred = theme.headerAlign === 'center';

  // Sized generously (2x the tallest theme logo height) and left to the theme's
  // CSS to scale down — one URL for every theme beats a render-time lookup.
  const logoSrc = cloudinaryUrl(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    tenant.logoPublicId,
    { width: 320 },
  );

  return (
    <div
      className='st-root flex min-h-screen flex-col bg-white'
      style={themeStyle(tenant.theme, tenant.primaryColor)}
    >
      <header className='sticky top-0 z-30 border-b bg-white/95 backdrop-blur'>
        <div
          className='mx-auto flex max-w-6xl items-center px-4'
          style={{ paddingBlock: 'var(--st-header-pad)' }}
        >
          {/* A centred wordmark is the one structural difference between the
              themes' headers. The cart stays pinned right in both, because a
              shopper looks for it in the same place on every store. */}
          <Link
            href={STOREFRONT_ROUTES.home}
            className={cn(
              'flex items-center gap-2',
              centred ? 'flex-1 justify-center pl-8' : 'flex-1',
            )}
          >
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- a Cloudinary delivery URL sized by the theme's logo height; next/image would re-optimise an already-optimised asset
              <img
                src={logoSrc}
                alt={tenant.name}
                className='w-auto'
                style={{ height: 'var(--st-logo-height)' }}
              />
            ) : (
              <span
                className='font-semibold'
                style={{
                  fontSize: 'calc(var(--st-logo-height) * 0.56)',
                  textTransform: 'var(--st-name-transform)' as 'none',
                  letterSpacing: 'var(--st-name-tracking)',
                }}
              >
                {tenant.name}
              </span>
            )}
          </Link>

          <Link
            href={STOREFRONT_ROUTES.cart}
            className='relative flex shrink-0 items-center gap-2 text-sm'
            aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}
          >
            <ShoppingBag className='size-5' />
            {mounted && count > 0 ? (
              <span
                className='absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full text-xs font-medium text-white'
                style={{ backgroundColor: 'var(--brand)' }}
              >
                {count}
              </span>
            ) : null}
          </Link>
        </div>
        {/* A hairline, not a band. A full-bleed header in an unreviewed tenant
            hex is the failure mode the brief warns about; 2px of it is not. */}
        {theme.brandRule ? (
          <div
            className='h-0.5 w-full'
            style={{ backgroundColor: 'var(--brand)' }}
          />
        ) : null}
      </header>

      <main className='flex-1'>{children}</main>

      <footer className='mt-16 border-t bg-gray-50'>
        <div className='mx-auto max-w-6xl px-4 py-8 text-sm text-gray-600'>
          <p className='font-medium text-gray-900'>{tenant.name}</p>
          {tenant.tagline ? <p className='mt-1'>{tenant.tagline}</p> : null}
          <div className='mt-3 flex flex-wrap gap-4'>
            {tenant.contactEmail ? (
              <a
                href={`mailto:${tenant.contactEmail}`}
                className='hover:underline'
              >
                {tenant.contactEmail}
              </a>
            ) : null}
            {tenant.whatsappNumber ? (
              <a
                href={`https://wa.me/${tenant.whatsappNumber.replace(/\D/g, '')}`}
                target='_blank'
                rel='noopener noreferrer'
                className='hover:underline'
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </footer>
    </div>
  );
}
