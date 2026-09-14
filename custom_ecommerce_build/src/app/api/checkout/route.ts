import { randomUUID } from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';

import { checkoutSchema, mergeCartItems } from '@core/validation/checkout';
import {
  computeDiscountKobo,
  couponRejectionReason,
} from '@core/validation/coupon';
import { hasVariants, variantLabel, variantPriceKobo } from '@core/variants';

import { initializeTransaction } from '@/lib/payments/paystack';
// eslint-disable-next-line no-restricted-imports -- resolves the tenant itself; every tenant-owned read below goes through tenantDb()
import { prisma } from '@/lib/prisma';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { tenantDb } from '@/lib/tenant-db';

import { DeliveryMethod, TenantStatus } from '@/generated/prisma/client';

/**
 * Creates a PENDING order with a server-computed total, then initializes the
 * payment server-side.
 *
 * The client sends product ids and quantities. It never gets to say what
 * anything costs, and it never sees a mutable amount — only an opaque Paystack
 * `access_code` whose amount is fixed on Paystack's side.
 */
export async function POST(req: NextRequest) {
  // Set by proxy.ts from the hostname. Any inbound value was stripped there.
  const tenantSlug = req.headers.get('x-tenant-slug');
  if (!tenantSlug) {
    return NextResponse.json(
      { error: 'Missing tenant context' },
      { status: 400 },
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
  if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }
  if (!tenant.paystackSubaccountCode) {
    return NextResponse.json(
      { error: 'This store is not yet set up to receive payments' },
      { status: 503 },
    );
  }

  // Every attempt writes an Order row and hits Paystack, so this is throttled
  // independently of the coupon oracle.
  const limit = rateLimit(clientKey(req, `checkout:${tenantSlug}`), {
    limit: 8,
    windowSeconds: 60,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait a moment.' },
      {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfterSeconds) },
      },
    );
  }

  const parsed = checkoutSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid checkout details', issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const db = tenantDb(tenant.id);

  // ── Re-price every line from the database ──────────────────────────────────
  const items = mergeCartItems(body.items);
  const products = await db.product.findMany({
    where: { id: { in: items.map((i) => i.productId) }, isActive: true },
    include: { variants: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  let subtotalKobo = 0;
  const orderItems: Array<{
    productId: string;
    variantId: string | null;
    quantity: number;
    productName: string;
    variantLabel: string | null;
    unitPriceKobo: number;
  }> = [];

  for (const item of items) {
    const product = productById.get(item.productId);
    if (!product) {
      return NextResponse.json(
        { error: 'One or more items are no longer available' },
        { status: 409 },
      );
    }

    const sellsByVariant = hasVariants(product);

    // Reject a mismatch in both directions. A variant id on a product that has
    // none is either a stale cart or a probe; accepting it and ignoring the id
    // would write an order line nobody can fulfil.
    if (sellsByVariant && !item.variantId) {
      return NextResponse.json(
        {
          error: `Choose a ${product.optionName ?? 'option'} for ${product.name}`,
        },
        { status: 400 },
      );
    }
    if (!sellsByVariant && item.variantId) {
      return NextResponse.json(
        { error: 'One or more items are no longer available' },
        { status: 409 },
      );
    }

    // `product.variants` came from a tenant-scoped query and is filtered to
    // this product, so finding the id in it proves ownership on both axes —
    // no second lookup that could resolve another tenant's variant.
    const variant = item.variantId
      ? (product.variants.find((v) => v.id === item.variantId && v.isActive) ??
        null)
      : null;

    if (item.variantId && !variant) {
      return NextResponse.json(
        { error: 'One or more items are no longer available' },
        { status: 409 },
      );
    }

    const stock = variant ? variant.stock : product.stock;
    const unitPriceKobo = variantPriceKobo(product, variant);
    const label = variant
      ? variantLabel(product.optionName, variant.value)
      : null;

    if (stock < item.quantity) {
      return NextResponse.json(
        {
          error: `${product.name}${label ? ` (${label})` : ''} does not have enough stock`,
        },
        { status: 409 },
      );
    }

    subtotalKobo += unitPriceKobo * item.quantity;
    orderItems.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity: item.quantity,
      productName: product.name,
      variantLabel: label,
      unitPriceKobo,
    });
  }

  // ── Delivery ───────────────────────────────────────────────────────────────
  let deliveryFeeKobo = 0;
  if (body.deliveryMethod === DeliveryMethod.ZONE_DELIVERY) {
    const zone = await db.deliveryZone.findFirst({
      where: { id: body.deliveryZoneId, isActive: true },
    });
    if (!zone) {
      return NextResponse.json(
        { error: 'Invalid delivery zone' },
        { status: 400 },
      );
    }
    deliveryFeeKobo = zone.feeKobo;
  }

  // ── Coupon ─────────────────────────────────────────────────────────────────
  // Same helpers as /api/coupons/preview, so the discount a customer was quoted
  // and the one they are charged cannot drift apart.
  let discountKobo = 0;
  let couponId: string | null = null;
  if (body.couponCode) {
    const coupon = await db.coupon.findFirst({
      where: { code: body.couponCode.toUpperCase() },
    });

    const rejection = couponRejectionReason(coupon, subtotalKobo);
    if (rejection || !coupon) {
      return NextResponse.json({ error: rejection }, { status: 400 });
    }

    discountKobo = computeDiscountKobo(coupon, subtotalKobo);
    couponId = coupon.id;
  }

  const totalKobo = subtotalKobo - discountKobo + deliveryFeeKobo;
  if (totalKobo <= 0) {
    return NextResponse.json({ error: 'Invalid order total' }, { status: 400 });
  }

  // ── Persist ────────────────────────────────────────────────────────────────
  const paymentReference = `ord_${tenant.slug}_${randomUUID()}`;

  // The platform's cut, computed once and recorded on the order before the
  // gateway is told about it. Snapshotting the rate matters: this order settles
  // at the percentage that applied when it was placed, even if the tenant's
  // rate is changed while the customer is still on the payment screen.
  const platformFeePercent = Number(tenant.platformFeePercent);
  const platformFeeKobo = Math.round((totalKobo * platformFeePercent) / 100);

  const order = await prisma.$transaction(async (tx) => {
    // Per-tenant human-readable number. Incrementing inside the transaction
    // keeps it gap-free under concurrency.
    const { orderSequence } = await tx.tenant.update({
      where: { id: tenant.id },
      data: { orderSequence: { increment: 1 } },
      select: { orderSequence: true },
    });

    return tx.order.create({
      data: {
        tenantId: tenant.id,
        orderNumber: orderSequence,
        customerName: body.customerName,
        customerEmail: body.customerEmail,
        customerPhone: body.customerPhone,
        deliveryMethod: body.deliveryMethod,
        deliveryZoneId: body.deliveryZoneId ?? null,
        deliveryAddress: body.deliveryAddress ?? null,
        deliveryFeeKobo,
        couponId,
        discountKobo,
        subtotalKobo,
        totalKobo,
        paymentReference,
        platformFeeKobo,
        platformFeePercent: tenant.platformFeePercent,
        items: { create: orderItems },
      },
    });
  });

  // ── Initialize payment (amount pinned server-side) ─────────────────────────
  try {
    const transaction = await initializeTransaction({
      email: body.customerEmail,
      amountKobo: totalKobo,
      reference: paymentReference,
      subaccountCode: tenant.paystackSubaccountCode,
      transactionChargeKobo: platformFeeKobo > 0 ? platformFeeKobo : undefined,
      callbackUrl: `${req.nextUrl.origin}/order/${paymentReference}`,
      // Lets the webhook attribute an event to a tenant without a DB round trip.
      metadata: { tenantId: tenant.id, orderId: order.id },
    });

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.orderNumber,
      reference: paymentReference,
      accessCode: transaction.access_code,
      authorizationUrl: transaction.authorization_url,
    });
  } catch {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'CANCELLED',
        internalNote: 'Payment initialization failed',
      },
    });
    return NextResponse.json(
      { error: 'Could not start payment. Please try again.' },
      { status: 502 },
    );
  }
}
