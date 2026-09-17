import axios, { isAxiosError } from 'axios';

import { toast } from '@/components/ui/sonner';

/**
 * Axios instance for dashboard and storefront calls.
 *
 * Same-origin `/api/*`, which `proxy.ts` forwards to the NestJS API. On the
 * dashboard the Clerk session token is attached as a Bearer header, the same
 * way the mobile app authenticates: a fresh token from Clerk's SDK, rather than
 * a session cookie the API would have to validate across a proxy hop.
 * Storefront pages load no Clerk, so shoppers send nothing.
 */
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

type ClerkWindow = Window & {
  Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
};

api.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    const token = await (window as ClerkWindow).Clerk?.session
      ?.getToken()
      .catch(() => null);
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isAxiosError(error)) {
      if (error.response?.status === 401) {
        toast.error('Your session expired. Please sign in again.');
        window.location.href = '/sign-in';
      } else if (error.response?.status === 403) {
        toast.error('You do not have permission to perform this action.');
      }
    }
    return Promise.reject(error);
  },
);

export async function apiFetcher<T>(path: string): Promise<T> {
  const { data } = await api.get<T>(path);
  return data;
}

export function handleApiError(error: unknown): void {
  const message = isAxiosError(error)
    ? (error.response?.data?.error ??
      error.response?.data?.message ??
      'An error occurred. Please try again.')
    : 'An error occurred. Please try again.';
  toast.error('Request failed', { description: message });
}

/**
 * Checkout failures are the one place a toast is not enough — a customer
 * mid-payment will miss it. Callers render this inline next to the pay button.
 */
export function extractErrorMessage(error: unknown): string {
  return isAxiosError(error)
    ? (error.response?.data?.error ?? 'Payment could not be started.')
    : 'Payment could not be started.';
}
