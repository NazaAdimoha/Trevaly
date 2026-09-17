import { timingSafeEqual } from 'node:crypto';

import type { Request } from 'express';

import type { Env } from '../config/env';

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** True when the request carries the proxy's internal key. */
export function fromTrustedProxy(req: Request, env: Env): boolean {
  const key = req.header('x-internal-key');
  return Boolean(env.INTERNAL_API_KEY && key && safeEqual(key, env.INTERNAL_API_KEY));
}

/**
 * The shopper's IP, for rate-limit keys.
 *
 * Requests that come through the web proxy arrive from the proxy's address, so
 * every shopper would share one bucket. The proxy therefore stamps
 * `x-client-ip` — trusted ONLY alongside the internal key, because anyone can
 * send the header itself. Everything else uses `req.ip`, which `trust proxy`
 * (TRUST_PROXY_HOPS) has already resolved past the load balancer.
 */
export function clientIp(req: Request, env: Env): string {
  if (fromTrustedProxy(req, env)) {
    const forwarded = req.header('x-client-ip')?.trim();
    if (forwarded) return forwarded;
  }
  return req.ip ?? 'unknown';
}
