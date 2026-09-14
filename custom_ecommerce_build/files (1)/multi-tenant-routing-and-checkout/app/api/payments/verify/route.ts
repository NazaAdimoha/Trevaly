import { NextRequest, NextResponse } from 'next/server';
import { verifyAndFulfillOrder } from '@/lib/payments/verify-order';

// app/api/payments/verify/route.ts
// Called by the frontend immediately after Paystack's popup reports
// success. This is a courtesy fast-path for the UI — the webhook below is
// the path that's actually trusted to run even if the customer closes the
// tab before this request completes.
export async function POST(req: NextRequest) {
  const { reference } = (await req.json()) as { reference: string };

  if (!reference) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 });
  }

  try {
    const order = await verifyAndFulfillOrder(reference);
    return NextResponse.json({ status: order.status, orderId: order.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
