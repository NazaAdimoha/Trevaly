import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

import { Toaster } from '@/components/ui/sonner';

/**
 * Document shell for every surface — platform and storefront alike.
 *
 * Deliberately free of `ClerkProvider`. It lives in `app/(platform)/layout.tsx`
 * instead, so storefronts never mount it: they are a wholly public surface with
 * a Lighthouse ≥ 90 target (M5), and a provider here would ship Clerk's client
 * bundle and its session round-trip to every product page view for a visitor
 * who can never be signed in. Keeping it out is also why `proxy.ts` runs
 * `clerkMiddleware` on platform hosts only — same boundary, both layers.
 */

/**
 * `metadataBase` resolves every relative canonical and OG image below this
 * layout. Without it Next cannot build an absolute URL for them and silently
 * drops the tag.
 *
 * It points at the PLATFORM domain, which is right for marketing and the
 * dashboard and wrong for a storefront — a tenant's pages must be canonical to
 * the tenant's own host, or the same catalogue is indexed twice. That override
 * lives in `app/sites/[tenant]/layout.tsx`, which knows the tenant.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com';

export const metadata: Metadata = {
  metadataBase: new URL(`https://${ROOT_DOMAIN}`),
  title: {
    default: 'Multi-Tenant Commerce',
    template: '%s | Multi-Tenant Commerce',
  },
  description: 'Online stores for Nigerian businesses.',
  openGraph: {
    type: 'website',
    // Not cosmetic: one of the few signals that places these results in
    // Nigerian SERPs rather than generic English ones.
    locale: 'en_NG',
  },
  twitter: { card: 'summary_large_image' },
  formatDetection: { telephone: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        {children}
        <Toaster position='top-right' richColors />
      </body>
    </html>
  );
}
