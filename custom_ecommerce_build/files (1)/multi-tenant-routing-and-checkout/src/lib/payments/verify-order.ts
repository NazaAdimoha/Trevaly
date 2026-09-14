import { prisma } from '@/lib/prisma';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY as string;

// src/lib/payments/verify-order.ts
// The single source of truth for "is this order actually paid." Called from
// two places — the client-triggered verify route (Section below) and the
// Paystack webhook — so verification logic exists in exactly one place and
// can't drift between the two paths.
export async function verifyAndFulfillOrder(reference: string) {
  const order = await prisma.order.findUnique({
    where: { paymentReference: reference },
    include: { items: true },
  });

  if (!order) {
    throw new Error('Order not found for this payment reference');
  }

  // Idempotency: whichever path (client callback or webhook) gets here
  // first wins; the other finds an already-PAID order and does nothing.
  if (order.status === 'PAID') {
    return order;
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
      cache: 'no-store',
    },
  );

  if (!res.ok) {
    throw new Error('Could not reach Paystack to verify this transaction');
  }

  const payload = await res.json();
  const transaction = payload?.data;

  const paidSuccessfully = transaction?.status === 'success';
  // Confirm the amount actually charged matches what we computed at
  // checkout — this is what stops someone from paying for a cheaper item
  // and replaying the reference against a more expensive order.
  const amountMatches = transaction?.amount === order.totalKobo;

  if (!paidSuccessfully || !amountMatches) {
    throw new Error(
      'Payment could not be verified against the expected order amount',
    );
  }

  return prisma.$transaction(async (tx) => {
    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    if (order.couponId) {
      await tx.coupon.update({
        where: { id: order.couponId },
        data: { timesUsed: { increment: 1 } },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: { status: 'PAID', paymentVerifiedAt: new Date() },
    });
  });
}
