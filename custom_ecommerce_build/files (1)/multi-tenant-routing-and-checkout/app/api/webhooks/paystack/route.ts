import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { verifyAndFulfillOrder } from '@/lib/payments/verify-order';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

// app/api/webhooks/paystack/route.ts
// This is the trusted reconciliation path (Section 7.4 of the breakdown
// doc) — it runs regardless of whether the customer's browser ever made it
// back to /api/payments/verify.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  const expectedSignature = crypto
    .createHmac('sha512', PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody);

  if (event.event === 'charge.success') {
    const reference = event.data?.reference;
    if (reference) {
      // Reuses the exact same verify-and-fulfill logic as the client route
      // above — same idempotency guarantee, so a webhook that arrives after
      // the client already verified the order simply no-ops.
      await verifyAndFulfillOrder(reference).catch((err) => {
        console.error(`Webhook fulfillment failed for ${reference}:`, err);
      });
    }
  }

  return NextResponse.json({ received: true });
}
