import { type NextRequest, NextResponse } from 'next/server';

import { couponPreviewSchema } from '@core/validation/checkout';
import {
  computeDiscountKobo,
  publicCouponRejection,
} from '@core/validation/coupon';

// eslint-disable-next-line no-restricted-imports -- resolves the tenant itself; the coupon lookup below is scoped
import { prisma } from '@/lib/prisma';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { tenantDb } from '@/lib/tenant-db';

/**
 * Shows a customer what a coupon is worth before they commit to paying.
 *
 * Strictly a UX affordance — `/api/checkout` recomputes the discount from the
 * database and ignores anything decided here.
 *
 * Rate limited because this endpoint is an oracle: it distinguishes a valid code
 * from an invalid one, unauthenticated, and coupon codes are short and
 * guessable. Without a limit, enumerating a store's active codes is trivial.
 */
export async function POST(req: NextRequest) {
  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) {
    return NextResponse.json(
      { error: 'Missing tenant context' },
      { status: 400 },
    );
  }

  const limit = rateLimit(clientKey(req, `coupon:${tenantSlug}`), {
    limit: 10,
    windowSeconds: 60,
  });

  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  const parsed = couponPreviewSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: { id: true },
  });
  if (!tenant) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { code, subtotalKobo } = parsed.data;

  const coupon = await tenantDb(tenant.id).coupon.findFirst({
    where: { code: code.toUpperCase() },
  });

  const rejection = publicCouponRejection(coupon, subtotalKobo);
  if (rejection || !coupon) {
    // Deliberately uniform: never distinguish "no such code" from "expired", or
    // the rate limit only slows enumeration down rather than blinding it. The
    // message comes from core so checkout says exactly the same thing.
    return NextResponse.json(
      { valid: false, error: rejection },
      { status: 200 },
    );
  }

  return NextResponse.json({
    valid: true,
    code: coupon.code,
    discountKobo: computeDiscountKobo(coupon, subtotalKobo),
  });
}
