import type { Request } from 'express';

import type { Tenant, TenantRole } from '../generated/prisma/client';

/** What web's `authorizeStore` returned; handlers receive the same thing. */
export type StoreAuth = { tenant: Tenant; role: TenantRole; userId: string };

/** Fields the guards attach. Set only by guards — never read from the client. */
export type AuthedRequest = Request & {
  requestId?: string;
  userId?: string;
  store?: StoreAuth;
};
