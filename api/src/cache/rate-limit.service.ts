import { Injectable, Logger } from '@nestjs/common';

import { ApiException } from '../common/api-exception';

import { RedisService } from './redis.service';

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type Window = { limit: number; windowSeconds: number };

/**
 * Fixed-window rate limiter — the same algorithm, keys and limits as web's
 * `lib/rate-limit.ts`, over Redis so the limit holds across instances.
 * This closes security audit finding 8.
 *
 * Without Redis (development and tests only; production refuses to boot) it
 * falls back to process memory, which is web's old behaviour.
 *
 * FAILS OPEN on a Redis error. A limiter outage must not stop every checkout;
 * it is logged once per outage by RedisService.
 */
@Injectable()
export class RateLimitService {
  private readonly logger = new Logger('RateLimit');
  private readonly memory = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly redis: RedisService) {}

  async hit(key: string, { limit, windowSeconds }: Window): Promise<RateLimitResult> {
    const windowMs = windowSeconds * 1000;
    const client = this.redis.client;

    if (client) {
      try {
        const redisKey = `rl:${key}`;
        // SET NX starts the window only if none is running; INCR counts this
        // hit; PTTL says when the window ends. One round trip, atomic.
        const results = await client
          .multi()
          .set(redisKey, '0', 'PX', windowMs, 'NX')
          .incr(redisKey)
          .pttl(redisKey)
          .exec();
        const count = Number(results?.[1]?.[1] ?? 0);
        const ttlMs = Number(results?.[2]?.[1] ?? windowMs);
        return {
          ok: count <= limit,
          remaining: Math.max(0, limit - count),
          retryAfterSeconds: count <= limit ? 0 : Math.ceil(Math.max(ttlMs, 0) / 1000),
        };
      } catch (err) {
        this.logger.warn({
          msg: 'Rate limit check failed; allowing request',
          err: err instanceof Error ? err.message : String(err),
        });
        return { ok: true, remaining: limit, retryAfterSeconds: 0 };
      }
    }

    return this.hitInMemory(key, limit, windowMs);
  }

  /** `hit`, throwing web's 429 `{ error }` with `Retry-After` when over. */
  async enforce(key: string, window: Window, message: string): Promise<void> {
    const result = await this.hit(key, window);
    if (!result.ok) {
      throw new ApiException(429, message, {}, {
        'Retry-After': String(result.retryAfterSeconds),
      });
    }
  }

  private hitInMemory(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = this.memory.get(key);

    if (!existing || existing.resetAt <= now) {
      // Bounded like web's LRU: drop expired windows when the map grows.
      if (this.memory.size > 20_000) {
        for (const [k, v] of this.memory) if (v.resetAt <= now) this.memory.delete(k);
      }
      this.memory.set(key, { count: 1, resetAt: now + windowMs });
      return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    existing.count += 1;
    return {
      ok: existing.count <= limit,
      remaining: Math.max(0, limit - existing.count),
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }
}
