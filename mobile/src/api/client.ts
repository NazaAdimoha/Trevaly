import { getClerkInstance } from '@clerk/expo';
import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';
import type { z } from 'zod';

/**
 * The one way this app talks to the server.
 *
 * Two things every request carries, and neither is optional:
 *
 *  1. A Clerk session token as a bearer header. Verified end to end against the
 *     running API — `authorizeStore()` needed no change, because tenant
 *     membership is a database check against the slug in the URL and never
 *     cared how the caller authenticated.
 *
 *  2. The app version, so the server can answer "you must update". A mobile
 *     client is versioned by the App Store, not by a deploy.
 *
 * Responses are parsed with the shared Zod schemas rather than cast. Compile
 * time cannot catch a *deployed* server that is newer than the installed app;
 * failing loudly beats rendering `undefined` in a merchant's order list.
 */

/** The port the Next.js API listens on. Overridable for a non-standard setup. */
const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '3000';

/** Loopback or RFC1918 — an address that only means anything on this network. */
function isLocalAddress(url: string): boolean {
  const host = url.replace(/^https?:\/\//, '').split(/[:/]/)[0] ?? '';
  if (host === 'localhost' || host.endsWith('.local')) return true;

  const [a, b] = host.split('.').map(Number);
  if (a === undefined || Number.isNaN(a)) return false;
  return (
    a === 127 ||
    a === 10 ||
    (a === 192 && b === 168) ||
    (a === 172 && b !== undefined && b >= 16 && b <= 31)
  );
}

/**
 * Where the API lives.
 *
 * A DEPLOYED url wins outright — that is a deliberate choice and nothing here
 * should second-guess it.
 *
 * Otherwise the host is DERIVED from whatever machine is serving this bundle
 * (`hostUri` is `192.168.x.x:8081` on a device, `localhost:8081` on a
 * simulator) rather than read from `.env`. Metro and the API run on the same
 * machine, so that address is correct by construction.
 *
 * This exists because a hard-coded LAN address in `.env` went stale three times
 * in one week — every time the machine joined a different network — and the
 * symptom is uniquely misleading: the app loads fine, then every screen quietly
 * serves cached data because the API it is dialling no longer exists. Deriving
 * the host removes the whole class of failure instead of fixing it once more.
 */
function resolveApiBase(): string {
  const configured =
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ??
    process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configured && !isLocalAddress(configured)) return configured;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants.expoGoConfig as { debuggerHost?: string } | undefined)
      ?.debuggerHost;

  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:${API_PORT}`;

  return configured ?? `http://localhost:${API_PORT}`;
}

const apiBase = resolveApiBase();

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export const api = axios.create({
  baseURL: `${apiBase}/api`,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // `getToken()` refreshes a short-lived token transparently. Clerk's default
  // session-token lifetime is 60 seconds, and that TTL is the only thing
  // bounding how long a revoked session keeps working — never lengthen it to
  // reduce refresh chatter.
  const token = await getClerkInstance().session?.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-App-Version'] = APP_VERSION;
  return config;
});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly isAuth: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Turns an axios failure into something a screen can render verbatim. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const status = error.response?.status ?? 0;
    const body = error.response?.data as { error?: string } | undefined;

    if (status === 0) {
      return new ApiError('No connection. Check your data and try again.', 0, false);
    }
    return new ApiError(
      body?.error ?? 'Something went wrong. Please try again.',
      status,
      status === 401 || status === 403,
    );
  }
  return new ApiError('Something went wrong. Please try again.', 0, false);
}

/** GET and validate. The schema is the contract, shared with the server. */
export async function getParsed<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    const { data } = await api.get(path);
    const result = schema.safeParse(data);

    if (!result.success) {
      // The first version threw a bare "This app is out of date", which was
      // both usually wrong and impossible to debug — it hid which endpoint and
      // which field had actually failed. Name them.
      const issue = result.error.issues[0];
      const where = issue?.path.join('.') || 'response';
      console.warn(`[api] ${path} failed validation at "${where}":`, issue?.message);

      throw new ApiError(
        `The server sent something this app did not expect (${path} → ${where}). Update the app if this keeps happening.`,
        426,
        false,
      );
    }
    return result.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(error);
  }
}
