import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  UseGuards,
} from '@nestjs/common';

import type { AuthedRequest, StoreAuth } from './auth.types';
import { ClerkAuthGuard } from './clerk-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { StoreMemberGuard } from './store-member.guard';

/** Any signed-in user. */
export const SignedIn = () => UseGuards(ClerkAuthGuard);

/** A member of `:storeSlug`, or platform staff. Guards run in the order listed. */
export const StoreMember = () =>
  applyDecorators(UseGuards(ClerkAuthGuard, StoreMemberGuard));

/** Platform SUPER_ADMIN only. */
export const PlatformAdmin = () =>
  applyDecorators(UseGuards(ClerkAuthGuard, PlatformAdminGuard));

/** The Clerk user id set by `ClerkAuthGuard`. */
export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string => {
    const userId = ctx.switchToHttp().getRequest<AuthedRequest>().userId;
    if (!userId) throw new Error('@CurrentUser() used without @SignedIn()');
    return userId;
  },
);

/** The store, role and user set by `StoreMemberGuard`. */
export const CurrentStore = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): StoreAuth => {
    const store = ctx.switchToHttp().getRequest<AuthedRequest>().store;
    if (!store) throw new Error('@CurrentStore() used without @StoreMember()');
    return store;
  },
);
