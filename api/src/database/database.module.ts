import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Global: one `PrismaService`, one pool, shared by every module. `tenantDb()` is
 * a plain function over it rather than a provider — each extension is cheap to
 * create and shares the base client's pool (plan 3.6).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class DatabaseModule {}
