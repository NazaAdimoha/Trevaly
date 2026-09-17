import { Controller, Get, HttpCode, Inject } from '@nestjs/common';

import type { MyStoresResponse } from '@core/api/contracts';
import { cloudinaryUrl } from '@core/media/folder';

import type { StoreAuth } from '../../auth/auth.types';
import { CurrentStore, CurrentUser, SignedIn, StoreMember } from '../../auth/decorators';
import { tenantOrigin } from '../../common/tenant-origin';
import { ENV, type Env } from '../../config/config.module';
import { PrismaService } from '../../database/prisma.service';

/**
 * Who the caller is, and what they may act for.
 *
 * Membership lookups use the unscoped client: this is where tenant scoping
 * BEGINS — there is no tenant yet to scope to.
 */
@Controller()
export class IdentityController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  /**
   * NEW. The signed-in user and their platform role, for the dashboard layout
   * ("show the Platform link?") and `requirePlatformAdmin` — both read
   * `PlatformUser` straight from the database on web today.
   */
  @Get('me')
  @HttpCode(200)
  @SignedIn()
  async me(@CurrentUser() userId: string) {
    const platformUser = await this.prisma.platformUser.findUnique({
      where: { clerkUserId: userId },
      select: { role: true },
    });
    return { userId, platformRole: platformUser?.role ?? null };
  }

  /** The stores this user may act for. Same table the store guard checks. */
  @Get('me/stores')
  @HttpCode(200)
  @SignedIn()
  async myStores(@CurrentUser() userId: string): Promise<MyStoresResponse> {
    const memberships = await this.prisma.tenantUser.findMany({
      where: { clerkUserId: userId },
      include: { tenant: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: memberships.map(({ tenant, role }) => ({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        theme: tenant.theme,
        role,
        logoUrl: cloudinaryUrl(this.env.CLOUDINARY_CLOUD_NAME, tenant.logoPublicId, {
          width: 256,
          height: 256,
          crop: 'fill',
        }),
        currency: tenant.currency,
        storefrontUrl: tenantOrigin(tenant, this.env),
      })),
    };
  }

  /**
   * NEW. The store, the caller's role in it, and the canonical storefront URL —
   * what web's `requireTenantMember` returned to the dashboard pages.
   *
   * 404 for a store the caller does not belong to (the guard), never 403.
   */
  @Get('stores/:storeSlug')
  @HttpCode(200)
  @StoreMember()
  store(@CurrentStore() store: StoreAuth) {
    return {
      tenant: store.tenant,
      role: store.role,
      viaPlatform: store.viaPlatform ?? false,
      storefrontUrl: tenantOrigin(store.tenant, this.env),
    };
  }
}
