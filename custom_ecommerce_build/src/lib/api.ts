import axios, { isAxiosError } from 'axios';

import { toast } from '@/components/ui/sonner';

/**
 * Axios instance for dashboard and storefront calls.
 *
 * Unlike the Ceviant back-office this is not fronting an external service — the
 * API routes live in this same app, so the Clerk session cookie is sent
 * automatically and there is no Bearer token to inject.
 */
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
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
