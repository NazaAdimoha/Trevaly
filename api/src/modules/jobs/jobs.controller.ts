import { Controller, Get, HttpCode, Inject, Req } from '@nestjs/common';
import type { Request } from 'express';

import { ApiException } from '../../common/api-exception';
import { safeEqual } from '../../common/client-ip';
import { ENV, type Env } from '../../config/config.module';
import { WebhookEventsService } from '../payments/webhook-events.service';

/** Scheduled work, called by the Render Cron Job (plan 3.3). */
@Controller('jobs')
export class JobsController {
  constructor(
    private readonly events: WebhookEventsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * Cancel PENDING orders nobody paid for. Mutates orders across every tenant,
   * so it refuses outright without a configured secret rather than defaulting
   * to open.
   */
  @Get('expire-orders')
  @HttpCode(200)
  async expireOrders(@Req() req: Request) {
    const secret = this.env.CRON_SECRET;
    if (!secret) throw new ApiException(503, 'CRON_SECRET is not configured');

    const header = req.header('authorization') ?? '';
    if (!safeEqual(header, `Bearer ${secret}`)) {
      throw new ApiException(401, 'Unauthorized');
    }

    return this.events.expireStaleOrders();
  }
}
