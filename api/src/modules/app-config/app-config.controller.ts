import { Controller, Get, Header, HttpCode, Inject } from '@nestjs/common';

import type { AppConfigResponse } from '@core/api/contracts';

import { ENV, type Env } from '../../config/config.module';

/**
 * `GET /api/app/config` — ported from web's route with an identical body and
 * the same `Cache-Control` header. The first endpoint the parity suite checks.
 *
 * Fetched by the mobile app on launch, before anything else. Unauthenticated
 * on purpose: an app that cannot sign in still needs to be told to update, and
 * gating this behind auth would make the one lever that unblocks a breaking
 * change unreachable exactly when it is needed.
 *
 * `minimumVersion` must ship even while it always answers "you are fine".
 * Without a gate already installed, the oldest build in the wild constrains the
 * API forever — there is no way to add one retroactively.
 */
@Controller('app')
export class AppConfigController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Get('config')
  @HttpCode(200)
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  getConfig(): AppConfigResponse {
    return {
      minimumVersion: this.env.MOBILE_MINIMUM_VERSION,
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
      webDashboardUrl: `https://${this.env.ROOT_DOMAIN}/dashboard`,
      // Public by design — it appears in every delivery URL the storefront
      // emits. The secret is the API secret, which stays server-side.
      cloudinaryCloudName: this.env.CLOUDINARY_CLOUD_NAME ?? null,
    };
  }
}
