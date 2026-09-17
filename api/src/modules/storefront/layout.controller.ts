import { Body, Controller, Get, HttpCode, Post, Put } from '@nestjs/common';
import { z } from 'zod';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, StoreMember } from '../../auth/decorators';
import { ZodPipe } from '../../common/zod.pipe';

import { StorefrontLayoutService } from './layout.service';

/**
 * The merchant's design endpoints — what the app's Design section talks to.
 *
 * Behind `StoreMember`, so a merchant can only redesign a store they belong to.
 * The public read lives on the storefront controller instead, where no session
 * exists.
 */
const versionedSchema = z.object({
  /** The version the editor loaded. See `saveDraft` on the service. */
  version: z.number().int().min(1),
});

const draftSchema = versionedSchema.extend({
  layout: z.unknown(),
});

@Controller('stores/:storeSlug/storefront')
@StoreMember()
export class StorefrontLayoutController {
  constructor(private readonly layouts: StorefrontLayoutService) {}

  @Get()
  @HttpCode(200)
  get(@CurrentStore() { tenant }: StoreAuth) {
    return this.layouts.forMerchant(tenant);
  }

  @Put('draft')
  @HttpCode(200)
  saveDraft(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(draftSchema, 'Invalid storefront layout'))
    body: z.infer<typeof draftSchema>,
  ) {
    return this.layouts.saveDraft(tenant, body.layout, body.version);
  }

  @Post('publish')
  @HttpCode(200)
  publish(
    @CurrentStore() { tenant }: StoreAuth,
    @Body(new ZodPipe(versionedSchema, 'Invalid request')) body: z.infer<typeof versionedSchema>,
  ) {
    return this.layouts.publish(tenant, body.version);
  }

  @Post('revert')
  @HttpCode(200)
  revert(@CurrentStore() { tenant }: StoreAuth) {
    return this.layouts.revert(tenant);
  }
}
