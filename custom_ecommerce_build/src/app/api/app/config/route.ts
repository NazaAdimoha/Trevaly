import { NextResponse } from 'next/server';

import type { AppConfigResponse } from '@core/api/contracts';

/**
 * Fetched by the mobile app on launch, before anything else.
 *
 * Unauthenticated on purpose: an app that cannot sign in still needs to be told
 * to update, and gating this behind auth would make the one lever that unblocks
 * a breaking change unreachable exactly when it is needed.
 *
 * `minimumVersion` must ship in v1 even while it always answers "you are fine".
 * Without a gate already installed, the oldest build in the wild constrains the
 * API forever — there is no way to add one retroactively.
 */
export function GET() {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'yourbrand.com';

  const body: AppConfigResponse = {
    minimumVersion: process.env.MOBILE_MINIMUM_VERSION ?? '1.0.0',
    updateMessage:
      'Update the app to keep taking orders. The new version is in the store.',
    features: {
      // Server-driven so a half-built screen can be dark-launched, and an old
      // build can be told to hide something it should no longer show.
      orders: true,
      products: true,
      addProduct: true,
      push: false,
    },
    webDashboardUrl: `https://${rootDomain}/dashboard`,
    // Public by design — it appears in every delivery URL the storefront emits.
    // The secret is the API secret, which stays server-side.
    cloudinaryCloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? null,
  };

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
  });
}
