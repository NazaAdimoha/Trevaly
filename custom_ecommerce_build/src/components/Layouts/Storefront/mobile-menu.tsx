'use client';

import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { cloudinaryUrl } from '@core/media/folder';

import { useIsOpen, useStorefrontUi } from '@/lib/store/ui';
import { useTenant } from '@/lib/tenant-context';
import { cn } from '@/lib/utils';

import { STOREFRONT_ROUTES } from '@/constant/routes';

import { Drawer } from './drawer';
import type { NavItem } from './header';

/**
 * Navigation on a phone: a full-height panel, not a dropdown.
 *
 * Most of this store's traffic arrives from a WhatsApp link on a mid-range
 * Android, so this is the primary navigation, not the fallback. Sections expand
 * in place rather than pushing a second screen, because a shopper who has to
 * navigate to navigate usually leaves instead.
 */
export function MobileMenu({ nav }: { nav: NavItem[] }) {
  const open = useIsOpen('menu');
  const close = useStorefrontUi((s) => s.close);
  const tenant = useTenant();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Drawer open={open} onClose={close} side='left' title={tenant.name}>
      <nav className='px-5 py-2'>
        <ul>
          {nav.map((item) => {
            const isOpen = expanded === item.label;
            return (
              <li key={item.label + item.href} className='st-hairline border-b last:border-0'>
                <div className='flex items-center justify-between'>
                  <Link
                    href={item.href}
                    onClick={close}
                    className='st-display flex-1 py-4 text-xl'
                  >
                    {item.label}
                  </Link>
                  {item.children.length > 0 ? (
                    <button
                      type='button'
                      onClick={() => setExpanded(isOpen ? null : item.label)}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Hide' : 'Show'} ${item.label} links`}
                      className='p-2'
                    >
                      <ChevronDown
                        className={cn('size-5 transition-transform', isOpen && 'rotate-180')}
                      />
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  <ul className='pb-3'>
                    {item.children.map((child) => (
                      <li key={child.href + child.label}>
                        <Link
                          href={child.href}
                          onClick={close}
                          className='st-muted block py-2 text-base'
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* A store with nothing but links is a directory. The reference themes
            all put imagery in the mobile menu for the same reason. */}
        {nav.some((item) => item.children.some((child) => child.image)) ? (
          <div className='mt-6'>
            <p className='st-muted mb-3 text-xs tracking-[0.18em] uppercase'>
              Find your inspiration
            </p>
            <div className='-mx-1 flex gap-3 overflow-x-auto pb-2'>
              {nav
                .flatMap((item) => item.children)
                .filter((child) => child.image)
                .slice(0, 6)
                .map((child) => {
                  const src = cloudinaryUrl(
                    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
                    child.image,
                    { width: 400, height: 500, crop: 'fill' },
                  );
                  return (
                    <Link
                      key={`inspo-${child.href}-${child.label}`}
                      href={child.href}
                      onClick={close}
                      className='w-40 shrink-0'
                    >
                      <span className='st-media block aspect-[4/5]'>
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element -- sized Cloudinary delivery URL
                          <img src={src} alt='' className='size-full object-cover' loading='lazy' />
                        ) : null}
                      </span>
                      <span className='mt-2 block text-sm'>{child.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ) : null}

        <Link
          href={STOREFRONT_ROUTES.cart}
          onClick={close}
          className='st-btn st-btn-outline mt-6 mb-4 w-full'
        >
          View cart
        </Link>
      </nav>
    </Drawer>
  );
}
