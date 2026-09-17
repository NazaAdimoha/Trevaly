import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { ENV, type Env } from '../config/config.module';
import { PrismaClient } from '../generated/prisma/client';

// Module-level: the adapter's callbacks are built before `super()` returns,
// when `this` is not yet usable.
const logger = new Logger('Prisma');

const BOOT_ATTEMPTS = 3;

/**
 * The one database client, over the pooled (`-pooler`) Neon endpoint.
 *
 * `max` is per instance: instances × DB_POOL_MAX must stay under the pooler's
 * limit (plan 3.3). The pooler runs in transaction mode, so nothing here may
 * rely on session state — `SET LOCAL` inside a transaction only.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(@Inject(ENV) env: Env) {
    super({
      adapter: new PrismaPg(
        {
          connectionString: env.DATABASE_URL,
          max: env.DB_POOL_MAX,
          idleTimeoutMillis: 30_000,
          // Long enough for a suspended Neon compute to wake; short enough
          // that a dead database fails a request rather than hanging it.
          connectionTimeoutMillis: 10_000,
          // Detect a silently dead socket instead of letting a request wait
          // on it until the platform's request timeout.
          keepAlive: true,
        },
        {
          // A reset on an idle or in-transaction connection. The adapter
          // already keeps these from crashing the process, but only reports
          // them to `debug` — without this they are invisible in production.
          // The pool discards the broken client and opens a new one.
          onPoolError: (err) =>
            logger.warn({ msg: 'Idle database connection dropped', err: err.message }),
          onConnectionError: (err) =>
            logger.warn({ msg: 'Database connection error', err: err.message }),
        },
      ),
      log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  /**
   * Open a connection before the app listens.
   *
   * Without this the first connection — TLS, plus waking a suspended compute —
   * happens inside the first health check, which then times out, and Render
   * marks a perfectly good new instance unhealthy mid-deploy.
   *
   * Retried a few times, because one reset handshake should not fail an
   * instance. Beyond that it throws: an instance that cannot reach the database
   * must never take traffic, and the previous deploy keeps serving.
   */
  async onModuleInit(): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      const started = Date.now();
      try {
        await this.$queryRaw`SELECT 1`;
        logger.log({ msg: 'Database connected', attempt, ms: Date.now() - started });
        return;
      } catch (err) {
        if (attempt >= BOOT_ATTEMPTS) throw err;
        logger.warn({
          msg: 'Database not reachable at boot, retrying',
          attempt,
          err: err instanceof Error ? err.message : String(err),
        });
        await new Promise((resolve) => setTimeout(resolve, 1_000 * attempt));
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
