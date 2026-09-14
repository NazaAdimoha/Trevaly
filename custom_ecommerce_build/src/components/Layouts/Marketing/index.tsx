import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';

import JsonLd from '@/components/JsonLd';

import { BRAND } from '@/constant/marketing';
import ROUTES from '@/constant/routes';

import Wordmark from './wordmark';

/**
 * Public marketing shell — root domain only.
 *
 * Deliberately free of Clerk, in both directions:
 *
 *  - `proxy.ts` does not run `clerkMiddleware` on these routes, so `auth()` is
 *    unavailable here by design.
 *  - There is no `ClerkProvider` in this subtree, so no Clerk client bundle is
 *    shipped to a visitor who arrived from an Instagram bio and will never sign
 *    in.
 *
 * The header still has two states. It reads the *presence* of a Clerk session
 * cookie to pick which link to show. That is a hint, not authentication, and it
 * is safe precisely because nothing is gated on it: a stale cookie shows a
 * "Dashboard" link, `/dashboard` runs the real check, and the visitor lands on
 * sign-in. Gating anything on this value would be a bug.
 */
async function hasSessionHint(): Promise<boolean> {
  const jar = await cookies();
  // Clerk names the session cookie `__session`, with a `__session_<suffix>`
  // variant when suffixed cookies are enabled on the instance.
  return jar.getAll().some((c) => c.name.startsWith('__session'));
}

const NAV_LINKS = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#what-you-get', label: 'What you get' },
  { href: '/#looks', label: 'Looks' },
  { href: ROUTES.pricing, label: 'Pricing' },
];

export default async function MarketingShell({
  children,
  activeNav,
}: {
  children: ReactNode;
  activeNav?: string;
}) {
  const signedIn = await hasSessionHint();
  const origin = `https://${BRAND.domain}`;

  /**
   * Organization + WebSite, on every marketing page. Both describe the site
   * itself rather than a page, so repeating them is expected — Google
   * deduplicates by `@id`-equivalent identity, and omitting them from
   * /pricing would mean the entity is missing on half our indexed surface.
   */
  const organizationSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: BRAND.name,
        url: origin,
        description: BRAND.tagline,
        areaServed: { '@type': 'Country', name: 'Nigeria' },
      },
      {
        '@type': 'WebSite',
        '@id': `${origin}/#website`,
        name: BRAND.name,
        url: origin,
        inLanguage: 'en-NG',
        publisher: { '@id': `${origin}/#organization` },
      },
    ],
  };

  return (
    <div className='bg-paper text-forest-900 font-body min-h-screen'>
      <JsonLd data={organizationSchema} />
      <header className='border-paper-line bg-paper/95 sticky top-0 z-30 border-b backdrop-blur'>
        <div className='mx-auto flex h-14 max-w-[1240px] items-center justify-between px-4 md:h-[76px] md:px-6'>
          <div className='flex items-center gap-10'>
            <Link href={ROUTES.home} aria-label={`${BRAND.name} home`}>
              <Wordmark />
            </Link>
            <nav className='text-grey-700 hidden items-center gap-7 text-[15px] md:flex'>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={
                    activeNav === link.href
                      ? 'text-forest-900 font-medium'
                      : 'hover:text-forest-900 transition-colors'
                  }
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className='flex items-center gap-4'>
            {signedIn ? (
              <Link
                href={ROUTES.dashboard.base}
                className='text-forest-900 hover:text-primary-700 text-[15px] font-medium transition-colors'
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href={ROUTES.signIn}
                className='text-forest-900 hover:text-primary-700 hidden text-[15px] font-medium transition-colors sm:block'
              >
                Sign in
              </Link>
            )}
            <Link
              href={ROUTES.signUp}
              className='bg-primary border-primary shadow-btn hover:bg-primary-600 hover:border-primary-600 inline-flex h-[38px] items-center rounded border px-4 text-[14.5px] font-medium text-white transition-all md:h-11 md:px-5 md:text-[15px]'
            >
              Get your store
            </Link>
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className='bg-forest-900 text-primary-200 px-4 py-12 md:px-6 md:py-14'>
        <div className='mx-auto max-w-[1240px]'>
          <div className='grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:gap-12'>
            <div>
              <Wordmark tone='light' />
              <p className='mt-4 max-w-[300px] text-[15px] leading-relaxed'>
                {BRAND.tagline} Built once, properly, and shared by every shop
                on it.
              </p>
              <address className='text-primary-400 mt-4 text-[14.5px] not-italic'>
                {BRAND.address}
              </address>
            </div>

            <FooterColumn
              title='Product'
              links={[
                { href: '/#what-you-get', label: 'What you get' },
                { href: ROUTES.pricing, label: 'Pricing' },
                { href: '/#looks', label: 'Storefront looks' },
                { href: '/#demo', label: 'Live demo store' },
              ]}
            />
            <FooterColumn
              title='Your store'
              links={[
                { href: ROUTES.signIn, label: 'Sign in' },
                { href: ROUTES.signUp, label: 'Get started' },
                { href: '/#faq', label: 'Help' },
              ]}
            />
            <FooterColumn
              title='Talk to us'
              links={[
                { href: '/#contact', label: 'WhatsApp' },
                { href: '/#contact', label: BRAND.email },
                { href: '/#contact', label: 'Instagram' },
              ]}
            />
          </div>

          <div className='border-forest-700 text-primary-400 mt-10 flex flex-col gap-2 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between'>
            <span>
              © {new Date().getFullYear()} {BRAND.name}. All prices in Naira.
            </span>
            <span>Payments processed by Paystack.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: ReadonlyArray<{ href: string; label: string }>;
}) {
  return (
    <div>
      <h2 className='mb-4 text-[13px] font-semibold tracking-[0.08em] text-white uppercase'>
        {title}
      </h2>
      <ul className='flex flex-col gap-2.5 text-[15px]'>
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link
              href={link.href}
              className='transition-colors hover:text-white'
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
