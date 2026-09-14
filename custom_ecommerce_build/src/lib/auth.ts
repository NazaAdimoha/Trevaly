import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';

import { prisma } from '@/lib/prisma';

import ROUTES from '@/constant/routes';
import { PlatformRole, TenantRole } from '@/generated/prisma/client';

/**
 * Authorization for the platform dashboard.
 *
 * Clerk owns identity only. Tenancy lives in our own `TenantUser` table, so
 * membership is always a database check — never a claim read off the session.
 * See BUILD_PLAN.md D3 for why Clerk Organizations are deliberately not used.
 */

export async function requireUser() {
  const { userId } = await auth();
  if (!userId) redirect(ROUTES.signIn);
  return userId;
}

/**
 * Assert the signed-in user may administer `storeSlug`.
 *
 * Every tenant admin page and mutation must call this. The store slug comes
 * from the URL, and membership is verified against it directly — a user who
 * edits the slug in the address bar gets a 404, not another tenant's data.
 */
export async function requireTenantMember(storeSlug: string) {
  const userId = await requireUser();

  const membership = await prisma.tenantUser.findFirst({
    where: { clerkUserId: userId, tenant: { slug: storeSlug } },
    include: { tenant: true },
  });

  if (membership) {
    return { tenant: membership.tenant, role: membership.role, userId };
  }

  // Platform staff can open any store for support purposes. This is the only
  // path that bypasses membership, and it is an explicit, auditable branch.
  const platformUser = await prisma.platformUser.findUnique({
    where: { clerkUserId: userId },
  });

  if (platformUser) {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: storeSlug },
    });
    if (tenant) {
      return { tenant, role: TenantRole.OWNER, userId, viaPlatform: true };
    }
  }

  notFound();
}

export async function requireStoreOwner(storeSlug: string) {
  const context = await requireTenantMember(storeSlug);
  if (context.role !== TenantRole.OWNER) redirect(ROUTES.unauthorized);
  return context;
}

export async function requirePlatformAdmin() {
  const userId = await requireUser();

  const platformUser = await prisma.platformUser.findUnique({
    where: { clerkUserId: userId },
  });

  if (platformUser?.role !== PlatformRole.SUPER_ADMIN) {
    redirect(ROUTES.unauthorized);
  }

  return { userId, platformUser };
}

/** Every store the signed-in user can administer — drives the store switcher. */
export async function listMyStores() {
  const userId = await requireUser();

  const memberships = await prisma.tenantUser.findMany({
    where: { clerkUserId: userId },
    include: { tenant: true },
    orderBy: { createdAt: 'asc' },
  });

  return memberships.map((m) => ({ tenant: m.tenant, role: m.role }));
}
