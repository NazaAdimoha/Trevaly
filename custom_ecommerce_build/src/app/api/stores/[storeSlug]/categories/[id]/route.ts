import { type NextRequest, NextResponse } from 'next/server';

import { categoryUpdateSchema } from '@core/validation/category';

import { authorizeStore, handleApiRoute } from '@/lib/auth-api';
import { CrossTenantAccessError, tenantDb } from '@/lib/tenant-db';

import { Prisma } from '@/generated/prisma/client';

type RouteContext = { params: Promise<{ storeSlug: string; id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    const parsed = categoryUpdateSchema.safeParse(
      await req.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid category', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    try {
      const category = await tenantDb(tenant.id).category.update({
        where: { id },
        data: parsed.data,
      });
      return NextResponse.json(category);
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 },
        );
      }
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        return NextResponse.json(
          { error: 'Another category already uses this name' },
          { status: 409 },
        );
      }
      throw err;
    }
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  return handleApiRoute(async () => {
    const { storeSlug, id } = await params;
    const { tenant } = await authorizeStore(storeSlug);

    try {
      // `Product.category` is `onDelete: SetNull`, so deleting a category
      // un-files its products rather than taking them down with it. That is the
      // right trade — a mis-click must never remove a merchant's catalogue —
      // but it is silent, so the count is returned for the UI to confirm with.
      const db = tenantDb(tenant.id);
      const orphaned = await db.product.count({ where: { categoryId: id } });
      await db.category.delete({ where: { id } });

      return NextResponse.json({ orphaned });
    } catch (err) {
      if (err instanceof CrossTenantAccessError) {
        return NextResponse.json(
          { error: 'Category not found' },
          { status: 404 },
        );
      }
      throw err;
    }
  });
}
