import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { tenantDb } from '@/lib/tenant-db';

import { OrderStatus, type Prisma } from '@/generated/prisma/client';

const orderListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(OrderStatus).optional(),
  needsAttention: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

type RouteContext = { params: Promise<{ storeSlug: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = orderListQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { search, status, needsAttention, page, pageSize } = parsed.data;
    const db = tenantDb(tenant.id);

    const where: Prisma.OrderWhereInput = {
      ...(status ? { status } : {}),
      // Orders where money has moved and the store must decide something: paid
      // but unstockable, or paid after being cancelled.
      ...(needsAttention === 'true'
        ? { OR: [{ hasStockIssue: true }, { paidAfterCancellation: true }] }
        : {}),
      ...(search
        ? {
            OR: [
              { customerName: { contains: search, mode: 'insensitive' } },
              { customerEmail: { contains: search, mode: 'insensitive' } },
              { customerPhone: { contains: search } },
              // Order number is what a customer quotes on the phone.
              ...(Number.isInteger(Number(search))
                ? [{ orderNumber: Number(search) }]
                : []),
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      db.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          items: { select: { id: true, quantity: true, productName: true } },
          deliveryZone: { select: { name: true } },
        },
      }),
      db.order.count({ where }),
    ]);

    return NextResponse.json({
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    });
  });
}
