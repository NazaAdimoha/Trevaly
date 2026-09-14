import { useCallback, useEffect, useRef, useState } from 'react';
import type { z } from 'zod';

import { readCache, writeCache } from './cache';
import { ApiError, getParsed } from './client';

type Query<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refreshing: boolean;
  /** True when `data` came from the cache and the network refresh has failed. */
  stale: boolean;
  /** When `data` was fetched from the server, or null if never. */
  updatedAt: number | null;
  refresh: () => Promise<void>;
};

/**
 * Fetch-and-parse with pull-to-refresh and an offline cache, sized for four
 * screens.
 *
 * Deliberately not React Query. The app has a handful of endpoints and no
 * cache-invalidation graph to speak of; a dependency whose feature set exceeds
 * the problem is a dependency that gets misused later. Revisit if the screen
 * count doubles.
 *
 * `refreshing` is separate from `loading` so a pull-to-refresh does not blank a
 * screen the merchant is reading.
 *
 * The cache turns this into stale-while-revalidate: a warm start paints the last
 * known data immediately and refreshes behind it, so the app is useful on the
 * walk into the shop rather than showing a spinner against one bar of signal. A
 * failed refresh KEEPS the cached data and raises `stale` — the screen is honest
 * about being old rather than going blank, which is the failure that made the
 * app worthless off-network.
 */
export function useQuery<T>(
  path: string | null,
  schema: z.ZodType<T>,
  deps: readonly unknown[] = [],
): Query<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stale, setStale] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  // Guards a late cache read from overwriting a network response that already
  // landed, and a response for a previous `path` from landing on the new one.
  const requestId = useRef(0);

  // `data` itself is not in `run`'s dependency list, so reading it there would
  // see whatever it was when the callback was created. A ref is the accurate
  // answer to "is there anything on screen right now" at the moment a fetch
  // fails, which is what decides stale-vs-empty.
  const hasData = useRef(false);
  const remember = (value: T) => {
    hasData.current = true;
    setData(value);
  };

  const run = useCallback(
    async (isRefresh: boolean) => {
      if (!path) {
        // Nothing to fetch yet — usually the active store has not hydrated.
        // Stay in `loading` rather than falling through to an empty state that
        // says "no products" when the truth is "not asked yet".
        return;
      }

      const id = ++requestId.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      // Warm start: paint the cache first, then revalidate behind it. Skipped on
      // an explicit pull-to-refresh, where the merchant is asking for the truth
      // and already has something on screen.
      if (!isRefresh) {
        const hit = await readCache(path, schema);
        if (hit && id === requestId.current) {
          remember(hit.value);
          setUpdatedAt(hit.storedAt);
          setLoading(false);
        }
      }

      try {
        const fresh = await getParsed(path, schema);
        if (id !== requestId.current) return;

        remember(fresh);
        setError(null);
        setStale(false);
        setUpdatedAt(Date.now());
        void writeCache(path, fresh);
      } catch (err) {
        if (id !== requestId.current) return;

        setError(err instanceof ApiError ? err : null);
        // Only a screen with something on it can go stale. With no cached data
        // the caller still gets its error state and renders the failure.
        if (hasData.current) setStale(true);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [path, ...deps],
  );

  useEffect(() => {
    void run(false);
  }, [run]);

  const refresh = useCallback(async () => {
    await run(true);
  }, [run]);

  return { data, error, loading, refreshing, stale, updatedAt, refresh };
}
