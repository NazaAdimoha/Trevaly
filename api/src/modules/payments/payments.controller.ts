import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

import { Body, Controller, HttpCode, Inject, Logger, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';

import { ApiException } from '../../common/api-exception';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';
import { PaymentProvider, WebhookStatus } from '../../generated/prisma/enums';

import { FulfillmentService, OrderNotFoundError } from './fulfillment.service';
import { WebhookEventsService } from './webhook-events.service';
import { extractReference } from './webhook-payload';

/** Every event this API acts on names a transaction. */
const HANDLED = new Set([
  'charge.success',
  'charge.failed',
  'refund.processed',
  'charge.dispute.create',
  'charge.dispute.resolve',
]);

@Controller()
export class PaymentsController {
  private readonly logger = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillment: FulfillmentService,
    private readonly events: WebhookEventsService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * The storefront's fast path right after the Paystack popup reports success.
   * The webhook is the path actually trusted; both call the same fulfilment.
   *
   *   200  verified (PAID, or recorded as paid after cancellation)
   *   202  not verifiable yet — NOT a failure; the webhook may still land
   *   404  no such order
   */
  @Post('payments/verify')
  @HttpCode(200)
  async verify(@Body() body: unknown, @Res({ passthrough: true }) res: Response) {
    const reference = (body as { reference?: unknown } | null)?.reference;
    if (!reference || typeof reference !== 'string') {
      throw new ApiException(400, 'Missing reference');
    }

    try {
      const order = await this.fulfillment.verifyAndFulfillOrder(reference);
      return {
        status: order.status,
        orderId: order.id,
        orderNumber: order.orderNumber,
        // The page must say the money arrived — not "being confirmed", forever.
        paidAfterCancellation: order.paidAfterCancellation,
      };
    } catch (err) {
      if (err instanceof OrderNotFoundError) throw new ApiException(404, 'Order not found');
      this.logger.warn({
        msg: 'Verify not yet confirmable',
        reference,
        err: err instanceof Error ? err.message : String(err),
      });
      res.status(202);
      return { error: 'Payment is still being confirmed', status: 'PENDING' };
    }
  }

  /**
   * The trusted reconciliation path.
   *
   * The signature is computed over `req.rawBody` — the exact bytes Paystack
   * sent. Every event is persisted BEFORE processing, so a failure is always
   * traceable and replayable. 500 on failure so Paystack retries: a swallowed
   * error permanently drops a paid order.
   */
  @Post('webhooks/paystack')
  @HttpCode(200)
  async paystackWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Res({ passthrough: true }) res: Response,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !this.verifySignature(rawBody, req.header('x-paystack-signature'))) {
      throw new ApiException(401, 'Invalid signature');
    }

    const text = rawBody.toString('utf8');
    const event = JSON.parse(text) as {
      event: string;
      data?: Record<string, unknown> & { id?: number; metadata?: { tenantId?: string } | null };
    };

    const reference = extractReference(event.data);
    const providerEventId = event.data?.id ? String(event.data.id) : null;
    const eventKey = providerEventId ?? `no-id:${reference ?? randomUUID()}`;

    // Persist first. Unique per provider, so a redelivery collides here.
    const record = await this.prisma.webhookEvent.upsert({
      where: {
        provider_providerEventId: { provider: PaymentProvider.PAYSTACK, providerEventId: eventKey },
      },
      create: {
        provider: PaymentProvider.PAYSTACK,
        providerEventId: eventKey,
        eventType: event.event,
        reference,
        tenantId: event.data?.metadata?.tenantId ?? null,
        payload: JSON.parse(text),
      },
      update: { attempts: { increment: 1 } },
    });

    if (record.status === WebhookStatus.PROCESSED) {
      return { received: true, duplicate: true };
    }

    if (!HANDLED.has(event.event) || !reference) {
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { status: WebhookStatus.IGNORED, processedAt: new Date() },
      });
      return { received: true };
    }

    try {
      const data = (event.data ?? {}) as Record<string, unknown>;
      let note = 'Fulfilled';

      switch (event.event) {
        case 'charge.success':
          await this.fulfillment.verifyAndFulfillOrder(reference);
          break;
        case 'charge.failed':
          note = (await this.events.recordChargeFailure(reference, data)).note;
          break;
        case 'refund.processed':
          note = (await this.events.applyRefund(reference, data)).note;
          break;
        case 'charge.dispute.create':
          note = (await this.events.openDispute(reference, data)).note;
          break;
        case 'charge.dispute.resolve':
          note = (await this.events.resolveDispute(reference, data)).note;
          break;
      }

      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: {
          status: WebhookStatus.PROCESSED,
          processedAt: new Date(),
          // Why nothing changed is the first question a merchant asks.
          error: note.startsWith('No ') ? note : null,
        },
      });
      return { received: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await this.prisma.webhookEvent.update({
        where: { id: record.id },
        data: { status: WebhookStatus.FAILED, error: message },
      });
      this.logger.error({ msg: 'Webhook processing failed', eventType: event.event, reference, err: message });
      res.status(500);
      return { error: 'Fulfillment failed' };
    }
  }

  private verifySignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    const expected = createHmac('sha512', this.env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    // Length first: timingSafeEqual throws on a mismatch.
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
