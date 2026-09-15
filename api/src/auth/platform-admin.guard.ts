import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';

import { ApiException } from '../common/api-exception';
import { PrismaService } from '../database/prisma.service';
import { PlatformRole } from '../generated/prisma/enums';

import type { AuthedRequest } from './auth.types';

/** Web's `authorizePlatform`: SUPER_ADMIN only, otherwise 403 `Forbidden`. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (!req.userId) throw new ApiException(401, 'Not signed in');

    const platformUser = await this.prisma.platformUser.findUnique({
      where: { clerkUserId: req.userId },
    });
    if (platformUser?.role !== PlatformRole.SUPER_ADMIN) {
      throw new ApiException(403, 'Forbidden');
    }
    return true;
  }
}
