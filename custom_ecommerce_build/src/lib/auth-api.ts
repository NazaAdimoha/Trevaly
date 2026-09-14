import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

import {
  PlatformRole,
  type Tenant,
  TenantRole,
} from '@/generated/prisma/client';

/**
 * Authorization for route handlers.
 *
 * Separate from `@/lib/auth` because that module redirects, which is correct for
 * pages and wrong for an API — a fetch should get 401/403 JSON, not a 307 to a
 * login page that the caller will happily parse as data.
 *
 * Page layouts do NOT protect API routes. Every tenant-scoped handler must call
 * this itself.
 */

export type StoreAuth = { tenant: Tenant; role: TenantRole; userId: string };

export class ApiAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiAuthError';
  }
}

export async function authorizeStore(storeSlug: string): Promise<StoreAuth> {
  const { userId } = await auth();
  if (!userId) throw new ApiAuthError('Not signed in', 401);

  const membership = await prisma.tenantUser.findFirst({
    where: { clerkUserId: userId, tenant: { slug: storeSlug } },
    include: { tenant: true },
  });

  if (membership) {
    return { tenant: membership.tenant, role: membership.role, userId };
  }

  // Platform staff may act on any store for support. Explicit and auditable.
  const platformUser = await prisma.platformUser.findUnique({
    where: { clerkUserId: userId },
  });

  if (platformUser) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: storeSlug },
    });
    if (tenant) return { tenant, role: TenantRole.OWNER, userId };
  }

  // 404 rather than 403: do not confirm that a store exists to someone who has
  // no business knowing.
  throw new ApiAuthError('Store not found', 404);
}

export async function authorizePlatform(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new ApiAuthError('Not signed in', 401);

  const platformUser = await prisma.platformUser.findUnique({
    where: { clerkUserId: userId },
  });

  if (platformUser?.role !== PlatformRole.SUPER_ADMIN) {
    throw new ApiAuthError('Forbidden', 403);
  }

  return userId;
}

/** Wraps a handler so auth and validation failures become clean JSON responses. */
export function handleApiRoute<T>(fn: () => Promise<T>) {
  return fn().catch((err: unknown) => {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  });
}
