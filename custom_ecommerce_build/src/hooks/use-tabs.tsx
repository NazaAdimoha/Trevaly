'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export interface TabItem<T extends string = string> {
  label: string;
  value: T;
  component: React.ReactNode;
}

interface UseTabsOptions<T extends string> {
  tabs: TabItem<T>[];
  tabQueryName?: string;
  defaultTab?: T;
  navigationMode?: 'push' | 'replace';
}

export function useTabs<T extends string>({
  tabs,
  tabQueryName = 'tab',
  defaultTab,
  navigationMode = 'push',
}: UseTabsOptions<T>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentParam = searchParams.get(tabQueryName) as T | null;
  const isValidTab = currentParam
    ? tabs.some((t) => t.value === currentParam)
    : false;

  const activeTab: T = isValidTab
    ? (currentParam as T)
    : ((defaultTab ?? tabs[0]?.value) as T);

  const setTab = useCallback(
    (value: T) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(tabQueryName, value);
      const nextUrl = `${pathname}?${params.toString()}`;

      if (navigationMode === 'replace') {
        router.replace(nextUrl);
        return;
      }

      router.push(nextUrl);
    },
    [router, pathname, searchParams, tabQueryName, navigationMode],
  );

  return { activeTab, setTab };
}
