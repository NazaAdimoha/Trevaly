import { useEffect, useState } from 'react';

type FilterSerializer<TValue> = (value: TValue) => string;

type FilterSerializers<T extends Record<string, unknown>> = Partial<{
  [K in keyof T]: FilterSerializer<T[K]>;
}>;

interface UseFiltersOptions<T extends Record<string, unknown>> {
  debounceMs?: number;
  serializers?: FilterSerializers<T>;
}

function toValidDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function pad3(value: number): string {
  return String(value).padStart(3, '0');
}

function formatDateTime(date: Date, includeMilliseconds: boolean): string {
  const year = date.getFullYear();
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  if (!includeMilliseconds) {
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  const milliseconds = pad3(date.getMilliseconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}`;
}

export function serializeDateStartOfDay(value: unknown): string {
  const date = toValidDate(value);
  if (!date) return '';

  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return formatDateTime(normalized, false);
}

export function serializeDateEndOfDay(value: unknown): string {
  const date = toValidDate(value);
  if (!date) return '';

  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return formatDateTime(normalized, false);
}

function buildQueryString<T extends Record<string, unknown>>(
  filters: T,
  serializers: FilterSerializers<T>,
): string {
  const params = new URLSearchParams();

  Object.keys(filters).forEach((key) => {
    const typedKey = key as keyof T;
    const value = filters[typedKey];

    if (value === null || value === undefined || value === '') {
      return;
    }

    const serializer = serializers[typedKey];
    const serialized = serializer ? serializer(value) : String(value).trimEnd();

    if (serialized !== '') {
      params.set(key, serialized);
    }
  });

  return params.toString();
}

/**
 * Generic hook for managing filter state with debounced query-string generation.
 *
 * @example
 * const { filters, updateFilter, resetFilters, queryString } =
 *   useFilters({ userStatus: '', emailAddress: '' });
 *
 * // Pass queryString directly into your SWR key:
 * // useSWR(`/portal/users?${queryString}`)
 */
export function useFilters<T extends Record<string, unknown>>(
  initialFilters: T,
  options: number | UseFiltersOptions<T> = 300,
) {
  const config =
    typeof options === 'number' ? { debounceMs: options } : options;

  const debounceMs = config.debounceMs ?? 300;
  const serializers = config.serializers ?? {};

  const [filters, setFilters] = useState<T>(initialFilters);
  const [queryString, setQueryString] = useState<string | null>(null);

  // Build the initial query string synchronously on mount
  useEffect(() => {
    setQueryString(buildQueryString(filters, serializers));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced rebuild whenever filters change
  useEffect(() => {
    const handler = setTimeout(() => {
      setQueryString(buildQueryString(filters, serializers));
    }, debounceMs);

    return () => clearTimeout(handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const updateFilter = <K extends keyof T>(key: K, value: T[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateFilters = (newFilters: Partial<T>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters(initialFilters);
  };

  const clearFilter = <K extends keyof T>(key: K) => {
    setFilters((prev) => ({ ...prev, [key]: initialFilters[key] }));
  };

  return {
    filters,
    setFilters,
    updateFilter,
    updateFilters,
    resetFilters,
    clearFilter,
    queryString,
  };
}
