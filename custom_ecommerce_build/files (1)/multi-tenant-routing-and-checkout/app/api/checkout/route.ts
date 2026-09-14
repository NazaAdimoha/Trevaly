import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

type CheckoutItem = { productId: string; quantity: number };

type CheckoutPayload = {
  items: CheckoutItem[];
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryMethod: 'PICKUP' | 'ZONE_DELIVERY' | 'COURIER_API';
  deliveryZoneId?: string;
  deliveryAddress?: string;
  couponCode?: string;
};

// app/api/checkout/route.ts
// Creates a PENDING order with a server-computed total. The client sends
// what's in the cart; it never gets to say what anything costs.
export async function POST(req: NextRequest) {
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
  if (!tenant) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body = (await req.json()) as CheckoutPayload;

  if (!body.items?.length) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
  }

  // Re-price every line item from the DB — ignore any price the client sent.
  const productIds = body.items.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, tenantId: tenant.id, isActive: true },
  });

  if (products.length !== productIds.length) {
    return NextResponse.json(
      { error: 'One or more items are unavailable' },
      { status: 400 },
    );
  }

  let subtotalKobo = 0;
  const orderItemsData = body.items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    if (!product) {
      throw new Error('Product missing after lookup');
    }
    if (product.stock < item.quantity) {
      throw new Error(`${product.name} is out of stock`);
    }
    subtotalKobo += product.priceKobo * item.quantity;
    return {
      productId: product.id,
      quantity: item.quantity,
      unitPriceKobo: product.priceKobo,
    };
  });

  let deliveryFeeKobo = 0;
  if (body.deliveryMethod === 'ZONE_DELIVERY') {
    if (!body.deliveryZoneId) {
      return NextResponse.json(
        { error: 'Delivery zone is required' },
        { status: 400 },
      );
    }
    const zone = await prisma.deliveryZone.findFirst({
      where: { id: body.deliveryZoneId, tenantId: tenant.id, isActive: true },
    });
    if (!zone) {
      return NextResponse.json(
        { error: 'Invalid delivery zone' },
        { status: 400 },
      );
    }
    deliveryFeeKobo = zone.feeKobo;
  }

  let discountKobo = 0;
  let couponId: string | null = null;
  if (body.couponCode) {
    const coupon = await prisma.coupon.findUnique({
      where: { tenantId_code: { tenantId: tenant.id, code: body.couponCode } },
    });

    const isValid =
      coupon &&
      coupon.isActive &&
      (!coupon.expiresAt || coupon.expiresAt > new Date()) &&
      (coupon.maxUses === null || coupon.timesUsed < coupon.maxUses) &&
      subtotalKobo >= (coupon.minOrderKobo ?? 0);

    if (!isValid || !coupon) {
      return NextResponse.json(
        { error: 'Coupon is invalid or expired' },
        { status: 400 },
      );
    }

    const rawDiscount =
      coupon.type === 'PERCENTAGE'
        ? Math.round((subtotalKobo * coupon.value) / 100)
        : coupon.value;
    discountKobo = Math.min(rawDiscount, subtotalKobo);
    couponId = coupon.id;
  }

  const totalKobo = subtotalKobo - discountKobo + deliveryFeeKobo;
  const paymentReference = `ord_${tenant.slug}_${randomUUID()}`;

  const order = await prisma.order.create({
    data: {
      tenantId: tenant.id,
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
      items: { create: orderItemsData },
    },
  });

  // The frontend uses these to launch Paystack Inline/Popup directly —
  // amount and reference are both server-computed, never client-supplied.
  return NextResponse.json({
    orderId: order.id,
    paymentReference,
    amountKobo: totalKobo,
    publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY,
    subaccountCode: tenant.paystackSubaccountCode,
  });
}
