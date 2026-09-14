import { compareDesc, parseISO } from 'date-fns';

import { COUNTRIES_LIST } from '@/constant/countries';

export function getFromLocalStorage(key: string): string | null {
  if (typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}

export function enumToOptions<T extends string>(
  enumObj: Record<string, T>,
  labelFormatter?: (value: T) => string,
): { label: string; value: T }[] {
  const defaultFormatter = (value: T): string =>
    value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return Object.values(enumObj).map((value) => ({
    label: labelFormatter ? labelFormatter(value) : defaultFormatter(value),
    value,
  }));
}

export function getStatesByCountry(
  countryIso2: string,
): { label: string; value: string }[] {
  const country = COUNTRIES_LIST.find((c) => c.iso2 === countryIso2);
  if (!country) return [];
  return country.states
    .filter((s) => s.state_code !== null)
    .map((s) => ({
      label: s.name,
      value: s.state_code as string,
    }));
}

export function resolveStateName(
  stateCode: string,
  countryIso2: string,
): string {
  if (!stateCode) return stateCode;
  const states = getStatesByCountry(countryIso2);
  return states.find((s) => s.value === stateCode)?.label ?? stateCode;
}

export function resolveCountryName(value: string): string {
  if (!value) return value;
  const normalised = value.trim().toLowerCase();
  const match = COUNTRIES_LIST.find(
    (c) =>
      c.name.toLowerCase() === normalised ||
      c.iso2.toLowerCase() === normalised ||
      c.iso3.toLowerCase() === normalised,
  );
  return match ? match.name : value;
}

export function resolveOptionLabel(
  value: string | null | undefined,
  options: { label: string; value: string }[],
): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export function getFromSessionStorage(key: string): string | null {
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(key);
  }
  return null;
}

export function sortByDate<T>(
  items: T[],
  key: keyof T,
  order: 'asc' | 'desc' = 'desc',
): T[] {
  return [...items].sort((a, b) => {
    const dateA = parseISO(a[key] as string);
    const dateB = parseISO(b[key] as string);
    return order === 'desc'
      ? compareDesc(dateA, dateB)
      : compareDesc(dateB, dateA);
  });
}

export function getPaginationPages(
  currentPage: number,
  totalPages: number,
  sibling = 1,
  boundary = 3,
): (number | 'ellipsis')[] {
  if (totalPages <= 0) return [];

  const range = (start: number, end: number): number[] =>
    Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i);

  const leftBoundary = range(1, Math.min(boundary, totalPages));
  const rightBoundary = range(
    Math.max(1, totalPages - boundary + 1),
    totalPages,
  );
  const siblingWindow = range(
    Math.max(1, currentPage - sibling),
    Math.min(totalPages, currentPage + sibling),
  );

  const sorted = Array.from(
    new Set([...leftBoundary, ...siblingWindow, ...rightBoundary]),
  ).sort((a, b) => a - b);

  const result: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const page = sorted[i];
    if (i > 0) {
      const prev = sorted[i - 1];
      if (page - prev === 2) {
        // single hidden page — just show it instead of ellipsis
        result.push(prev + 1);
      } else if (page - prev > 2) {
        result.push('ellipsis');
      }
    }
    result.push(page);
  }

  return result;
}

export function paginateItems<T>(
  items: T[],
  page: number,
  pageSize: number,
): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
