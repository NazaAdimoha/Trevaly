import { Controller, Get, HttpCode, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RedisService } from '../cache/redis.service';
import { PrismaService } from '../database/prisma.service';

type Check = 'ok' | 'down' | 'not-configured';

/** Resolve within `ms` or reject — a hung dependency must fail the check, not stall it. */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), ms),
    ),
  ]);
}

/**
 * Readiness, for Render's `healthCheckPath` (plan 3.3).
 *
 * Touches Postgres and Key Value rather than just answering, because Render
 * uses this to decide whether a NEW instance may take traffic during a rolling
 * deploy — and whether to cancel the whole deploy. An instance that bound its
 * port but cannot reach the database must fail here, or it goes live broken.
 *
 * Not behind auth or rate limiting. Plain Nest rather than `@nestjs/terminus`,
 * whose indicator API changed in v12 for no benefit at this size.
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  @HttpCode(200)
  async check(@Res({ passthrough: true }) res: Response) {
    const [database, redis] = await Promise.all([
      withTimeout(this.prisma.$queryRaw`SELECT 1`, 2_000)
        .then((): Check => 'ok')
        .catch((): Check => 'down'),
      this.redis.client
        ? withTimeout(this.redis.client.ping(), 1_000)
            .then((): Check => 'ok')
            .catch((): Check => 'down')
        : Promise.resolve<Check>('not-configured'),
    ]);

    const healthy = database === 'ok' && redis !== 'down';
    res.status(healthy ? 200 : 503);
    res.setHeader('Cache-Control', 'no-store');
    return { status: healthy ? 'ok' : 'unavailable', checks: { database, redis } };
  }
}
