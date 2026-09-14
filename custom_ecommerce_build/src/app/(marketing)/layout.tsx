import { Bricolage_Grotesque, Schibsted_Grotesk } from 'next/font/google';
import type { ReactNode } from 'react';

/**
 * The public marketing surface, on the root domain.
 *
 * Note what is NOT here: `ClerkProvider`. The `(platform)` group mounts it for
 * `/dashboard` and the auth pages; marketing does not, so a visitor arriving
 * from an Instagram bio never downloads Clerk's client bundle. `proxy.ts` draws
 * the same boundary on the server by not running `clerkMiddleware` on these
 * routes — which is also what stopped `/` bouncing through Clerk's dev-browser
 * handshake on every first visit.
 *
 * Both fonts are self-hosted by `next/font`, so there is no request to a font
 * CDN and no layout shift while one resolves.
 */

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700'],
  variable: '--font-bricolage',
  display: 'swap',
});

const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-schibsted',
  display: 'swap',
});

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${bricolage.variable} ${schibsted.variable}`}>
      {children}
    </div>
  );
}
