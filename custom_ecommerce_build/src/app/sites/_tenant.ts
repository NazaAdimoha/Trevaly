import { cache } from 'react';

// eslint-disable-next-line no-restricted-imports -- resolves the tenant itself; this is the boundary where tenant scoping begins
import { prisma } from '@/lib/prisma';

import { TenantStatus } from '@/generated/prisma/client';

/**
 * Resolves a storefront tenant from the URL segment that `proxy.ts` rewrote in.
 *
 * Wrapped in React's `cache` so a page and its `generateMetadata` share one
 * query per request rather than issuing two — that doubling is easy to miss and
 * lands on every storefront page view.
 *
 * Deliberately reads the URL segment rather than the `x-tenant-slug` header: a
 * page must not be able to render another tenant's data even if header handling
 * is ever bypassed on some path.
 */
export const resolveStorefrontTenant = cache(async (slug: string) => {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      logoPublicId: true,
      primaryColor: true,
      tagline: true,
      theme: true,
      contactEmail: true,
      whatsappNumber: true,
      currency: true,
      // Not branding — these three decide the canonical host and the
      // structured data. Stripped before the tenant reaches the client
      // provider in `app/sites/[tenant]/layout.tsx`.
      customDomain: true,
      customDomainVerified: true,
      storeAddress: true,
    },
  });

  // A suspended store goes dark rather than serving a broken checkout.
  if (!tenant || tenant.status === TenantStatus.SUSPENDED) return null;

  return tenant;
});
