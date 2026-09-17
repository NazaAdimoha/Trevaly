import { Inject, Injectable } from '@nestjs/common';
import {
  authenticateRequest,
  type ClerkClient,
  createClerkClient,
} from '@clerk/express';
import type { Request } from 'express';

import { ENV, type Env } from '../config/config.module';

export type VerifiedSession = {
  userId: string;
  /** Present on browser-issued tokens only. */
  azp?: string;
};

/**
 * Verifies a Clerk session from the `Authorization: Bearer` header (mobile) or
 * the `__session` cookie (web dashboard) — the same two paths web's `auth()`
 * accepts.
 *
 * Called lazily by `ClerkAuthGuard`, not installed as global `clerkMiddleware`.
 * Global middleware would run token verification in front of every route,
 * including the Paystack webhook and the health check — so a Clerk JWKS hiccup
 * would fail payment webhooks and pull healthy instances out of rotation.
 * Routes that need no identity should not depend on the identity provider.
 */
@Injectable()
export class ClerkService {
  private readonly client: ClerkClient;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.client = createClerkClient({
      secretKey: env.CLERK_SECRET_KEY,
      publishableKey: env.CLERK_PUBLISHABLE_KEY,
      jwtKey: env.CLERK_JWT_KEY,
    });
  }

  /** The verified session, or null when the request carries none that is valid. */
  async verify(req: Request): Promise<VerifiedSession | null> {
    const state = await authenticateRequest({
      clerkClient: this.client,
      request: req,
      options: {
        secretKey: this.env.CLERK_SECRET_KEY,
        publishableKey: this.env.CLERK_PUBLISHABLE_KEY,
        jwtKey: this.env.CLERK_JWT_KEY,
        // Deliberately NOT `authorizedParties` — see ClerkAuthGuard.
      },
    });

    // `handshake` means a browser cookie needs refreshing via redirect. An API
    // never redirects (plan Part 4, row 6): the client gets 401 and its Clerk
    // SDK refreshes the token.
    if (state.status !== 'signed-in') return null;

    const auth = state.toAuth();
    if (!auth.userId) return null;

    const azp = auth.sessionClaims?.azp;
    return { userId: auth.userId, azp: typeof azp === 'string' ? azp : undefined };
  }
}
