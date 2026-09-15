import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { ApiException } from '../common/api-exception';
import { PrismaService } from '../database/prisma.service';
import { TenantRole } from '../generated/prisma/enums';

import type { AuthedRequest } from './auth.types';

/**
 * Web's `authorizeStore`, line for line. Runs after `ClerkAuthGuard` and reads
 * `:storeSlug` from the route. Attaches `req.store`.
 *
 *   1. A membership of this store → that membership's role.
 *   2. Otherwise any platform user acts as OWNER on a store that exists —
 *      support access, explicit and auditable.
 *   3. Otherwise 404 `Store not found`, not 403: do not confirm a store exists
 *      to someone who has no business knowing.
 *
 * Uses the unscoped client on purpose — this is the lookup that DECIDES the
 * tenant. Everything after it uses `tenantDb(prisma, req.store.tenant.id)`.
 */
@Injectable()
export class StoreMemberGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const userId = req.userId;
    if (!userId) throw new ApiException(401, 'Not signed in');

    const storeSlug = req.params.storeSlug;
    if (typeof storeSlug !== 'string' || !storeSlug) {
      // A route wired with this guard but no :storeSlug is a programming error.
      throw new Error('StoreMemberGuard used on a route without :storeSlug');
    }

    const membership = await this.prisma.tenantUser.findFirst({
      where: { clerkUserId: userId, tenant: { slug: storeSlug } },
      include: { tenant: true },
    });
    if (membership) {
      req.store = { tenant: membership.tenant, role: membership.role, userId };
      return true;
    }

    const platformUser = await this.prisma.platformUser.findUnique({
      where: { clerkUserId: userId },
    });
    if (platformUser) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { slug: storeSlug },
      });
      if (tenant) {
        req.store = { tenant, role: TenantRole.OWNER, userId };
        return true;
      }
    }

    throw new ApiException(404, 'Store not found');
  }
}
