import {
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';

import { normalizeHostname } from '@core/hostname';

import { ApiException } from '../../common/api-exception';
import { fromTrustedProxy } from '../../common/client-ip';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';

/**
 * Calls only the web proxy makes, authenticated with INTERNAL_API_KEY.
 * Never used to decide a tenant for a caller's own request.
 */
@Controller('internal')
export class InternalController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Custom domain → store slug, for `proxy.ts` (which keeps its LRU in front of
   * this). Only a VERIFIED domain resolves; everything else is 404, which the
   * proxy caches briefly as "no such tenant".
   */
  @Get('domains/:hostname')
  @HttpCode(200)
  async resolveDomain(@Req() req: Request, @Param('hostname') hostname: string) {
    if (!this.env.INTERNAL_API_KEY) {
      throw new ApiException(503, 'Internal API is not configured');
    }
    if (!fromTrustedProxy(req, this.env)) {
      throw new ApiException(401, 'Unauthorized');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { customDomain: normalizeHostname(hostname) },
      select: { slug: true, customDomainVerified: true },
    });
    if (!tenant?.customDomainVerified) throw new ApiException(404, 'Not found');

    return { slug: tenant.slug };
  }
}
