import crypto from 'crypto';
import { type NextRequest, NextResponse } from 'next/server';

import { verifyAndFulfillOrder } from '@/lib/payments/verify-order';
import {
  applyRefund,
  extractReference,
  openDispute,
  recordChargeFailure,
  resolveDispute,
} from '@/lib/payments/webhook-events';
// eslint-disable-next-line no-restricted-imports -- provider-to-server route: no tenant context to scope by; the tenant is derived from the event itself
import { prisma } from '@/lib/prisma';

import { PaymentProvider, WebhookStatus } from '@/generated/prisma/client';

/**
 * The trusted reconciliation path. Runs regardless of whether the customer's
 * browser ever made it back to /api/payments/verify.
 *
 * Every event is persisted BEFORE processing, so a failure is always traceable
 * and replayable. A handler that logs nothing turns a transient database blip
 * into money that silently vanished.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-paystack-signature');

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    event: string;
    data?: Record<string, unknown> & {
      id?: number;
      metadata?: { tenantId?: string } | null;
    };
  };

  // Refunds and disputes nest the transaction reference differently from a
  // charge, so this is no longer a plain property read.
  const reference = extractReference(event.data);
  const providerEventId = event.data?.id ? String(event.data.id) : null;

  // Persist first. `providerEventId` is unique per provider, so a redelivery
  // collides here instead of being processed twice.
  const record = await prisma.webhookEvent.upsert({
    where: {
      provider_providerEventId: {
        provider: PaymentProvider.PAYSTACK,
        providerEventId:
          providerEventId ?? `no-id:${reference ?? crypto.randomUUID()}`,
      },
    },
    create: {
      provider: PaymentProvider.PAYSTACK,
      providerEventId:
        providerEventId ?? `no-id:${reference ?? crypto.randomUUID()}`,
      eventType: event.event,
      reference,
      tenantId: event.data?.metadata?.tenantId ?? null,
      payload: JSON.parse(rawBody),
    },
    update: { attempts: { increment: 1 } },
  });

  if (record.status === WebhookStatus.PROCESSED) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Every event we act on names a transaction. Without a reference there is
  // nothing to attach it to.
  const HANDLED = new Set([
    'charge.success',
    'charge.failed',
    'refund.processed',
    'charge.dispute.create',
    'charge.dispute.resolve',
  ]);

  if (!HANDLED.has(event.event) || !reference) {
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: WebhookStatus.IGNORED, processedAt: new Date() },
    });
    return NextResponse.json({ received: true });
  }

  try {
    const data = (event.data ?? {}) as Record<string, unknown>;
    let note = 'Fulfilled';

    switch (event.event) {
      case 'charge.success':
        await verifyAndFulfillOrder(reference);
        break;

      // Paystack's documented event list does not include `charge.failed`, so
      // this may never fire on your instance. It costs nothing to handle and
      // fails closed if it does arrive — but the guarantee that a PENDING order
      // eventually resolves cannot rest on it. See `expireStaleOrders`.
      case 'charge.failed':
        note = (await recordChargeFailure(reference, data)).note;
        break;

      case 'refund.processed':
        note = (await applyRefund(reference, data)).note;
        break;

      case 'charge.dispute.create':
        note = (await openDispute(reference, data)).note;
        break;

      case 'charge.dispute.resolve':
        note = (await resolveDispute(reference, data)).note;
        break;
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
        // Why nothing changed is the first question asked when a merchant says
        // a refund did not show up. An empty log makes that unanswerable.
        error: note.startsWith('No ') ? note : null,
      },
    });
    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: WebhookStatus.FAILED, error: message },
    });

    // 500 so Paystack retries on its backoff schedule. Returning 200 here — as
    // a swallowed catch would — permanently drops a paid order.
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret || !signature) return false;

  const expected = crypto
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');

  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');

  // Length check first: timingSafeEqual throws on a length mismatch.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
