import { type NextRequest, NextResponse } from 'next/server';

import {
  OrderNotFoundError,
  verifyAndFulfillOrder,
} from '@/lib/payments/verify-order';

/**
 * Called by the storefront right after the Paystack popup reports success.
 *
 * A courtesy fast-path so the customer sees a confirmed order immediately — the
 * webhook is the path actually trusted to run even if the customer closes the
 * tab. Both call the same `verifyAndFulfillOrder`, so they cannot disagree.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    reference?: string;
  } | null;

  if (!body?.reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  try {
    const order = await verifyAndFulfillOrder(body.reference);
    return NextResponse.json({
      status: order.status,
      orderId: order.id,
      orderNumber: order.orderNumber,
    });
  } catch (err) {
    if (err instanceof OrderNotFoundError) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    // Not yet verifiable is not the same as failed — the webhook may still land.
    return NextResponse.json(
      { error: 'Payment is still being confirmed', status: 'PENDING' },
      { status: 202 },
    );
  }
}
