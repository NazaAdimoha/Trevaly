import { Body, Controller, Get, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';

import { tenantUploadFolder, tenantUploadFolders } from '@core/media/folder';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { RateLimitService } from '../../cache/rate-limit.service';
import { ApiException } from '../../common/api-exception';
import { clientIp } from '../../common/client-ip';
import { parseWith } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/config.module';
import { CloudinaryService } from '../../integrations/cloudinary.service';

const signatureRequestSchema = z.object({
  paramsToSign: z.record(z.string(), z.union([z.string(), z.number()])),
});

/**
 * The only parameters a client may have us sign. A signature is a capability;
 * an allowlist, because the risk is the parameter Cloudinary adds next year.
 */
const SIGNABLE_PARAMS = new Set(['folder', 'timestamp']);

/**
 * Baked into every signature. `allowed_formats` is the one constraint
 * Cloudinary lets us sign (verified against the live API — `resource_type` and
 * `max_file_size` are excluded from the signed string). SVG is excluded: a
 * script-bearing document served from a CDN origin is stored XSS.
 */
const ENFORCED_PARAMS = { allowed_formats: 'jpg,jpeg,png,webp,avif,heic,heif' } as const;

@Controller('stores/:storeSlug/uploads/signature')
@StoreMember()
export class UploadsController {
  constructor(
    private readonly rateLimit: RateLimitService,
    private readonly cloudinary: CloudinaryService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Sign an upload. The folder is the security boundary: derived from the
   * authorized tenant, and anything else is refused.
   */
  @Post()
  @HttpCode(200)
  async sign(@CurrentStore() { tenant }: StoreAuth, @Req() req: Request, @Body() raw: unknown) {
    await this.rateLimit.enforce(
      `upload-sign:${tenant.id}:${clientIp(req, this.env)}`,
      { limit: 30, windowSeconds: 60 },
      'Too many uploads. Please wait a moment.',
    );

    const { paramsToSign } = parseWith(signatureRequestSchema, raw, 'Invalid signature request', {
      withIssues: false,
    });

    // Rejected, not stripped: a silently dropped parameter becomes a signature
    // mismatch at Cloudinary that looks like our bug.
    const unexpected = Object.keys(paramsToSign).filter((key) => !SIGNABLE_PARAMS.has(key));
    if (unexpected.length > 0) {
      throw new ApiException(400, `Cannot sign: ${unexpected.join(', ')}`);
    }

    const allowed = tenantUploadFolders(tenant.slug);
    if (typeof paramsToSign.folder !== 'string' || !allowed.includes(paramsToSign.folder)) {
      throw new ApiException(403, 'Uploads must go to this store’s own folder');
    }

    const { apiSecret } = this.cloudinary.config();
    const signedParams = { ...paramsToSign, ...ENFORCED_PARAMS };

    return {
      signature: this.cloudinary.sign(signedParams, apiSecret),
      enforced: ENFORCED_PARAMS,
    };
  }

  /** Config the upload widget needs before it can start. */
  @Get()
  @HttpCode(200)
  config(@CurrentStore() { tenant }: StoreAuth) {
    const { cloudName, apiKey } = this.cloudinary.config();
    return {
      cloudName,
      apiKey,
      folder: tenantUploadFolder(tenant.slug),
      brandingFolder: tenantUploadFolder(tenant.slug, 'branding'),
    };
  }
}
