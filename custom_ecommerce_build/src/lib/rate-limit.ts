import { LRUCache } from 'lru-cache';

/**
 * Fixed-window rate limiter, in process memory.
 *
 * Honest about its limits: on Vercel each serverless instance keeps its own
 * counter, so the effective global limit is roughly `limit × instances`. That is
 * fine for what it defends against here — coupon-code brute force and checkout
 * spam from a single client — and wrong for anything that needs a hard global
 * cap. Move to Upstash Redis before relying on it for that (M8).
 */
const buckets = new LRUCache<string, { count: number; resetAt: number }>({
  max: 20_000,
  ttl: 60 * 60 * 1000,
});

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function rateLimit(
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number },
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, limit - existing.count);

  return {
    ok: existing.count <= limit,
    remaining,
    retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identity. `x-forwarded-for` is spoofable in general, but on
 * Vercel the platform overwrites it at the edge, so the leftmost entry is the
 * real client.
 */
export function clientKey(req: Request, scope: string): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const ip = forwarded.split(',')[0]?.trim() || 'unknown';
  return `${scope}:${ip}`;
}
