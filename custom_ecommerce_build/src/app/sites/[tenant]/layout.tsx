import type { Metadata } from 'next';
import { Archivo, Fredoka, Newsreader, Schibsted_Grotesk } from 'next/font/google';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { cloudinaryUrl } from '@core/media/folder';

import { tenantOrigin } from '@/lib/domains/canonical';
import { type PublicTenant, TenantProvider } from '@/lib/tenant-context';

import JsonLd from '@/components/JsonLd';
import StorefrontShell from '@/components/Layouts/Storefront';

import {
  getStorefrontCatalog,
  getStorefrontLayout,
  resolveStorefrontTenant,
} from '@/app/sites/_tenant';
import { STOREFRONT_ROUTES } from '@/constant/routes';

/**
 * Root of every tenant storefront.
 *
 * The tenant is re-resolved from the URL segment `proxy.ts` rewrote into —
 * deliberately not from the `x-tenant-slug` header. This redundancy is the
 * point: a page cannot render another tenant's data even if header handling is
 * ever bypassed on some path.
 */
/**
 * One typeface per storefront theme.
 *
 * `preload: false` on all three is what makes this affordable. Next preloads
 * fonts by default, which would fetch all three faces on every store — three
 * downloads to use one. Without preload the browser requests only the family
 * its store's theme actually references through `--st-font`, so per-store cost
 * is a single family, and the only shared overhead is two extra `@font-face`
 * blocks in the CSS. `next/font` still generates a metric-matched fallback for
 * each, so the swap does not move the layout.
 */
const groteskFont = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-st-grotesk',
  display: 'swap',
  preload: false,
});

const serifFont = Newsreader({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-st-serif',
  display: 'swap',
  preload: false,
});

const utilityFont = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-st-utility',
  display: 'swap',
  preload: false,
});

const roundedFont = Fredoka({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-st-rounded',
  display: 'swap',
  preload: false,
});

const FONT_VARIABLES = [
  groteskFont.variable,
  serifFont.variable,
  utilityFont.variable,
  roundedFont.variable,
].join(' ');

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string }>;
}): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);

  if (!tenant) return { title: 'Store not found' };

  // Square and large: this is the OG/Twitter card image and a social scraper
  // will not resize it for us.
  const logoUrl = cloudinaryUrl(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    tenant.logoPublicId,
    { width: 1200, height: 1200, crop: 'fit' },
  );

  const description = tenant.tagline ?? `Shop online at ${tenant.name}`;
  const origin = tenantOrigin(tenant);

  return {
    // Overrides the platform-domain base set in the root layout. A storefront
    // reachable at both its subdomain and a custom domain would otherwise be
    // indexed twice, splitting its ranking between two identical documents.
    metadataBase: new URL(origin),
    alternates: { canonical: '/' },
    title: { default: tenant.name, template: `%s | ${tenant.name}` },
    description,
    openGraph: {
      type: 'website',
      siteName: tenant.name,
      title: tenant.name,
      description,
      url: origin,
      images: logoUrl ? [logoUrl] : undefined,
    },
  };
}

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant: slug } = await params;
  const tenant = await resolveStorefrontTenant(slug);

  if (!tenant) notFound();

  const [layout, catalog] = await Promise.all([
    getStorefrontLayout(slug, tenant.theme),
    getStorefrontCatalog(slug),
  ]);

  /**
   * Navigation: what the merchant built, or their categories.
   *
   * The fallback matters more than the feature. Most stores will never open the
   * menu builder, and a shop with no way into its own categories is the state
   * ours has been in until now.
   */
  const nav =
    layout.header.menu.length > 0
      ? layout.header.menu.map((item) => ({
          label: item.label,
          href: item.href,
          children: item.children.map((child) => ({
            label: child.label,
            href: child.href,
            image: child.image ?? null,
          })),
        }))
      : (catalog?.categories ?? []).slice(0, 6).map((category) => ({
          label: category.name,
          href: STOREFRONT_ROUTES.category(category.slug),
          children: [],
        }));

  const suggestions = (catalog?.products ?? []).slice(0, 6).map((product) => ({
    name: product.name,
    slug: product.slug,
    imageUrl: product.imageUrls[0] ?? null,
  }));

  const logoUrl = cloudinaryUrl(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    tenant.logoPublicId,
    { width: 1200, height: 1200, crop: 'fit' },
  );

  // Everything destructured out here is server-only. `PublicTenant` is the
  // branding-safe subset that reaches the browser.
  const {
    status: _status,
    customDomain: _customDomain,
    customDomainVerified: _customDomainVerified,
    storeAddress,
    ...publicTenant
  } = tenant;

  /**
   * A store, described to search engines. `storeAddress` is what turns a
   * generic Store result into a local one — a Lagos street address does more
   * credibility work per byte than anything else the tenant can supply.
   */
  const storeSchema = {
    '@context': 'https://schema.org',
    '@type': storeAddress ? 'LocalBusiness' : 'Store',
    name: tenant.name,
    url: tenantOrigin(tenant),
    ...(tenant.tagline ? { description: tenant.tagline } : {}),
    ...(logoUrl ? { image: logoUrl, logo: logoUrl } : {}),
    ...(tenant.contactEmail ? { email: tenant.contactEmail } : {}),
    ...(tenant.whatsappNumber ? { telephone: tenant.whatsappNumber } : {}),
    ...(storeAddress
      ? {
          address: {
            '@type': 'PostalAddress',
            streetAddress: storeAddress,
            addressCountry: 'NG',
          },
        }
      : {}),
    currenciesAccepted: tenant.currency,
    paymentAccepted: 'Credit Card, Bank Transfer, USSD',
  };

  return (
    <TenantProvider tenant={publicTenant satisfies PublicTenant}>
      <JsonLd data={storeSchema} />
      {/* All three font variables are declared; only the family the tenant's
          theme references is ever matched, so only that one is downloaded. */}
      <div className={FONT_VARIABLES}>
        <StorefrontShell
          design={{ preset: layout.preset, tokens: layout.tokens }}
          chrome={{
            announcement: layout.announcement,
            header: layout.header,
            footer: layout.footer,
            mobileBar: layout.mobileBar,
          }}
          nav={nav}
          suggestions={suggestions}
        >
          {children}
        </StorefrontShell>
      </div>
    </TenantProvider>
  );
}
