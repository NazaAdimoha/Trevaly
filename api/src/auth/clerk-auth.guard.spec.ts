import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { ApiException } from '../common/api-exception';
import type { Env } from '../config/env';

import type { AuthedRequest } from './auth.types';
import { ClerkAuthGuard } from './clerk-auth.guard';
import type { ClerkService, VerifiedSession } from './clerk.service';

/**
 * The `azp` rule, which Clerk's own option gets wrong for native apps: a token
 * naming a foreign browser origin is refused; a token naming none — the Expo
 * app's — is accepted.
 */

function run(session: VerifiedSession | null, allowed: string[]) {
  const req = { headers: {} } as AuthedRequest;
  const clerk = { verify: async () => session } as unknown as ClerkService;
  const env = { CLERK_AUTHORIZED_PARTIES: allowed } as unknown as Env;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;

  return { req, result: new ClerkAuthGuard(clerk, env).canActivate(ctx) };
}

async function rejection(promise: Promise<unknown>) {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ApiException);
  return { status: (err as ApiException).getStatus(), body: (err as ApiException).getResponse() };
}

const ALLOWED = ['https://yourbrand.com', 'http://localhost:3000'];

describe('ClerkAuthGuard', () => {
  it('refuses a request with no valid session', async () => {
    expect(await rejection(run(null, ALLOWED).result)).toEqual({
      status: 401,
      body: { error: 'Not signed in' },
    });
  });

  it('accepts a native-app token, which carries no azp', async () => {
    const { req, result } = run({ userId: 'user_mobile' }, ALLOWED);
    await expect(result).resolves.toBe(true);
    expect(req.userId).toBe('user_mobile');
  });

  it('accepts a browser token from an allowed origin', async () => {
    const { result } = run({ userId: 'user_web', azp: 'https://yourbrand.com' }, ALLOWED);
    await expect(result).resolves.toBe(true);
  });

  it('refuses a browser token issued to a foreign origin', async () => {
    const { req, result } = run({ userId: 'user_web', azp: 'https://evil.example' }, ALLOWED);
    expect(await rejection(result)).toEqual({ status: 401, body: { error: 'Not signed in' } });
    expect(req.userId).toBeUndefined();
  });

  it('does not enforce azp when no origins are configured', async () => {
    const { result } = run({ userId: 'user_web', azp: 'https://anything.example' }, []);
    await expect(result).resolves.toBe(true);
  });
});
