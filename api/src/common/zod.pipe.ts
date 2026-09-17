import { type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

import { ApiException } from './api-exception';

/**
 * Validate with a Zod schema from `@core`, keeping each endpoint's own message.
 *
 * Not class-validator DTOs and not Nest 12's `StandardSchemaValidationPipe`:
 * the schemas already live in `packages/core` and are shared with both clients,
 * and the wire contract is `{ error: 'Invalid coupon', issues }` — a specific
 * message per endpoint, which web and mobile display (plan Part 4, row 2).
 *
 * @example
 * @Body(new ZodPipe(couponWriteSchema, 'Invalid coupon')) body: CouponWrite
 */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(
    private readonly schema: ZodType<T>,
    private readonly message: string,
  ) {}

  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new ApiException(400, this.message, { issues: parsed.error.issues });
    }
    return parsed.data;
  }
}

/**
 * Validate inside a handler, for the endpoints where web checked other things
 * FIRST — a store's status, or a rate limit that must count invalid attempts
 * too. A pipe runs before the handler body and would change which error a
 * caller sees.
 *
 * `withIssues: false` for endpoints whose web version returned the message
 * alone.
 */
export function parseWith<T>(
  schema: ZodType<T>,
  value: unknown,
  message: string,
  { withIssues = true }: { withIssues?: boolean } = {},
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiException(400, message, withIssues ? { issues: parsed.error.issues } : {});
  }
  return parsed.data;
}
