import { Injectable } from '@nestjs/common';

import { ApiException } from '../../common/api-exception';
import { PrismaService } from '../../database/prisma.service';
import { TenantStatus } from '../../generated/prisma/enums';

/** The storefront's tenant fields — web's `resolveStorefrontTenant` select. */
export const STOREFRONT_TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  logoPublicId: true,
  primaryColor: true,
  tagline: true,
  theme: true,
  contactEmail: true,
  whatsappNumber: true,
  currency: true,
  // Not branding: these decide the canonical host and structured data.
  customDomain: true,
  customDomainVerified: true,
  storeAddress: true,
} as const;

@Injectable()
export class StorefrontService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A store as shoppers may see it. A SUSPENDED store goes dark (404) rather
   * than serving a broken checkout; an ONBOARDING one still renders.
   */
  async publicTenant(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: STOREFRONT_TENANT_SELECT,
    });
    if (!tenant || tenant.status === TenantStatus.SUSPENDED) {
      throw new ApiException(404, 'Store not found');
    }
    return tenant;
  }
}
