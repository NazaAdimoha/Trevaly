import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authorizePlatform, handleApiRoute } from '@/lib/auth-api';
// eslint-disable-next-line no-restricted-imports -- platform-scoped: webhook events span every tenant, and many belong to none
import { prisma } from '@/lib/prisma';

import { WebhookStatus } from '@/generated/prisma/client';

const querySchema = z.object({
  status: z.enum(WebhookStatus).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Provider webhook deliveries, newest first.
 *
 * Every Paystack event is persisted BEFORE it is processed, and a FAILED row is
 * kept for replay rather than discarded. That makes this table the platform's
 * dead-letter queue — but until now nothing could read it, so a failed
 * fulfilment was only discoverable by querying Postgres by hand.
 *
 * The raw `payload` is deliberately not returned. It is the provider's full
 * event, which carries the shopper's email and card metadata, and an operator
 * triaging a failure needs the type, reference and error — not a customer's
 * details in a browser table.
 */
export async function GET(req: NextRequest) {
  return handleApiRoute(async () => {
    await authorizePlatform();

    const parsed = querySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { status, page, pageSize } = parsed.data;
    const where = status ? { status } : {};

    const [items, total, byStatus] = await Promise.all([
      prisma.webhookEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          provider: true,
          eventType: true,
          reference: true,
          tenantId: true,
          status: true,
          error: true,
          attempts: true,
          createdAt: true,
          processedAt: true,
        },
      }),
      prisma.webhookEvent.count({ where }),
      // Served by the existing `@@index([status, createdAt])`.
      prisma.webhookEvent.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const counts = Object.fromEntries(
      Object.values(WebhookStatus).map((s) => [
        s,
        byStatus.find((row) => row.status === s)?._count._all ?? 0,
      ]),
    ) as Record<WebhookStatus, number>;

    return NextResponse.json({ items, total, page, pageSize, counts });
  });
}
