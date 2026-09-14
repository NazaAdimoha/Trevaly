import { type NextRequest, NextResponse } from 'next/server';

import { categoryWriteSchema } from '@core/validation/category';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ storeSlug: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    // tenantId is injected by the wrapper — deliberately absent here.
    const items = await tenantDb(tenant.id).category.findMany({
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    });

    return NextResponse.json({ items });
  });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = categoryWriteSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid category', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const category = await tenantDb(tenant.id).category.create({
        data: parsed.data,
      } as never);
      return NextResponse.json(category, { status: 201 });
    } catch (err) {
      // Slugs are unique per tenant, so a clash is a user error with a specific
      // fix — not a 500.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'A category with this name already exists' },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}
