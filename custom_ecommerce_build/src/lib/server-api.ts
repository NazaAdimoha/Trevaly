import { auth } from '@clerk/nextjs/server';

/**
 * Server-to-server calls from Server Components and route handlers to the
 * NestJS API — the only way this app reaches data now. Web holds no database
 * URL and no Paystack or Cloudinary secret (BACKEND_MIGRATION_PLAN, Phase 5).
 *
 * Never import this from a Client Component: it reads `API_ORIGIN` and the
 * Clerk session on the server. Browser code calls same-origin `/api/*`
 * through `@/lib/api`, which `proxy.ts` forwards to the API.
 *
 * `cache: 'no-store'` on every call. The storefront read Postgres on every
 * request before the move, and changing freshness during a migration hides
 * regressions behind stale pages. Caching is a deliberate follow-up.
 */

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function apiOrigin(): string {
  const origin = process.env.API_ORIGIN;
  if (!origin) {
    throw new Error('API_ORIGIN is not set — the web app has no other way to reach its data');
  }
  return origin.replace(/\/+$/, '');
}

type Options = {
  /** Forward the signed-in user's Clerk session. Dashboard reads only. */
  signedIn?: boolean;
};

async function request(path: string, { signedIn = false }: Options): Promise<Response> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (signedIn) {
    const token = await (await auth()).getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  return fetch(`${apiOrigin()}/api${path}`, { headers, cache: 'no-store' });
}

/** GET a JSON resource. Any non-2xx throws `ApiRequestError` with its status. */
export async function apiGet<T>(path: string, options: Options = {}): Promise<T> {
  const res = await request(path, options);
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.error ?? `API responded ${res.status}`);
  }
  return body as T;
}

/** Like `apiGet`, but a 404 is `null` — a missing store, product or order. */
export async function apiGetOrNull<T>(path: string, options: Options = {}): Promise<T | null> {
  try {
    return await apiGet<T>(path, options);
  } catch (err) {
    if (err instanceof ApiRequestError && err.status === 404) return null;
    throw err;
  }
}
