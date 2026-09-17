import { Body, Controller, Get, HttpCode, Inject, Patch, Query } from '@nestjs/common';

import { cloudinaryUrl } from '@core/media/folder';
import {
  logoBelongsToStore,
  type StoreSettingsInput,
  storeSettingsSchema,
} from '@core/validation/store-settings';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ApiException } from '../../common/api-exception';
import { ZodPipe } from '../../common/zod.pipe';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import type { Tenant } from '../../generated/prisma/client';

import { OverviewService } from './overview.service';
import { parsePeriod, parseRange } from './period';

@Controller('stores/:storeSlug')
@StoreMember()
export class StoresController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly overview: OverviewService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * The numbers a merchant sees first. Unrecognised query values fall back to
   * a default rather than erroring.
   */
  @Get('overview')
  @HttpCode(200)
  getOverview(
    @CurrentStore() { tenant }: StoreAuth,
    @Query('period') period?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.overview.getStoreOverview(
      tenant,
      parsePeriod(typeof period === 'string' ? period : null),
      parseRange(typeof from === 'string' ? from : null, typeof to === 'string' ? to : null),
    );
  }

  @Get('settings')
  @HttpCode(200)
  getSettings(@CurrentStore() { tenant }: StoreAuth) {
    return this.settingsBody(tenant);
  }

  /**
   * PATCH rather than PUT: the app edits one field at a time. `Tenant` is not
   * tenant-scoped (it IS the tenant), so the write is pinned to the id the
   * guard resolved — the only row this route may touch.
   */
  @Patch('settings')
  @HttpCode(200)
  async updateSettings(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(storeSettingsSchema, 'Invalid settings')) body: StoreSettingsInput,
  ) {
    // Uploading outside the store's folder is refused at signing; PATCHing
    // another store's public ID straight in is refused here.
    if (!logoBelongsToStore(body.logoPublicId, tenant.slug)) {
      throw new ApiException(403, 'That image does not belong to this store');
    }

    const updated = await this.prisma.tenant.update({ where: { id: tenant.id }, data: body });
    return this.settingsBody(updated);
  }

  private settingsBody(tenant: Tenant) {
    return {
      name: tenant.name,
      slug: tenant.slug,
      tagline: tenant.tagline,
      primaryColor: tenant.primaryColor,
      theme: tenant.theme,
      logoPublicId: tenant.logoPublicId,
      logoUrl: cloudinaryUrl(this.env.CLOUDINARY_CLOUD_NAME, tenant.logoPublicId, {
        width: 512,
        height: 512,
        crop: 'fit',
      }),
    };
  }
}
