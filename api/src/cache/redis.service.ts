import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import Redis from 'ioredis';

import { ENV, type Env } from '../config/config.module';

/**
 * The shared store for rate limits and the domain cache (plan 3.3, Part 11):
 * Render Key Value in production.
 *
 * `client` is null only outside production — config refuses to boot production
 * without REDIS_URL. Consumers must treat null as "single-instance development
 * mode", never as a production fallback.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger('Redis');
  readonly client: Redis | null;

  constructor(@Inject(ENV) env: Env) {
    if (!env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL not set — running without a shared store. Acceptable for local development only.',
      );
      this.client = null;
      return;
    }

    this.client = new Redis(env.REDIS_URL, {
      // Fail a command fast rather than queueing it behind a dead connection:
      // a rate-limit check that hangs for a minute is worse than one that errors.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    // Log transitions, not every failed reconnect: ioredis retries every ~2s
    // during an outage, and a line each time buries the first one.
    let down = false;
    this.client.on('error', (err) => {
      if (down) return;
      down = true;
      this.logger.error({ msg: 'Redis connection lost', err: err.message });
    });
    this.client.on('ready', () => {
      if (!down) return;
      down = false;
      this.logger.log({ msg: 'Redis connection restored' });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.quit().catch(() => undefined);
  }
}
