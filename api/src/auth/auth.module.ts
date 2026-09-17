import { Global, Module } from '@nestjs/common';

import { ClerkAuthGuard } from './clerk-auth.guard';
import { ClerkService } from './clerk.service';
import { PlatformAdminGuard } from './platform-admin.guard';
import { StoreMemberGuard } from './store-member.guard';

/** Global so feature modules can use `@StoreMember()` without importing it. */
@Global()
@Module({
  providers: [ClerkService, ClerkAuthGuard, StoreMemberGuard, PlatformAdminGuard],
  exports: [ClerkService, ClerkAuthGuard, StoreMemberGuard, PlatformAdminGuard],
})
export class AuthModule {}
