import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';

/**
 * Everything served on the root domain: marketing, sign-in/up, and the tenant
 * dashboard. This is the only subtree that mounts Clerk.
 *
 * The route group `(platform)` does not appear in any URL — `/dashboard` and
 * `/sign-in` keep their paths. It exists purely to draw the auth boundary in
 * the file tree, so a page added under `app/sites/**` cannot accidentally
 * inherit a session provider that storefront visitors never need.
 *
 * `ClerkProvider` sits inside `<body>` because the root layout owns the
 * document element and this layout renders within it.
 */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
