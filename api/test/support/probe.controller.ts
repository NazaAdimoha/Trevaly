import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { z } from 'zod';

import type { AuthedRequest, StoreAuth } from '../../src/auth/auth.types';
import {
  CurrentStore,
  CurrentUser,
  PlatformAdmin,
  SignedIn,
  StoreMember,
} from '../../src/auth/decorators';
import { ApiException } from '../../src/common/api-exception';
import { ZodPipe } from '../../src/common/zod.pipe';

const thingSchema = z.object({ name: z.string().min(1) });

/**
 * Routes that exist only under test, to exercise the cross-cutting layer — the
 * error filter, validation, raw body, guards — before any real module uses it.
 */
@Controller('_probe')
export class ProbeController {
  @Get('api-exception')
  apiException() {
    throw new ApiException(409, 'Cannot move an order from PAID to PENDING', {
      allowed: ['PROCESSING'],
    });
  }

  @Get('boom')
  boom() {
    throw new Error('connection to db-secret-host.internal refused');
  }

  @Post('zod')
  @HttpCode(200)
  zod(@Body(new ZodPipe(thingSchema, 'Invalid thing')) body: z.infer<typeof thingSchema>) {
    return body;
  }

  @Post('raw')
  @HttpCode(200)
  raw(@Req() req: AuthedRequest & { rawBody?: Buffer }) {
    return { rawBytes: req.rawBody?.length ?? null };
  }

  @Get('me')
  @SignedIn()
  me(@CurrentUser() userId: string) {
    return { userId };
  }

  @Get('stores/:storeSlug')
  @StoreMember()
  store(@CurrentStore() store: StoreAuth) {
    return { slug: store.tenant.slug, role: store.role, userId: store.userId };
  }

  @Get('platform')
  @PlatformAdmin()
  platform(@CurrentUser() userId: string) {
    return { userId };
  }
}
