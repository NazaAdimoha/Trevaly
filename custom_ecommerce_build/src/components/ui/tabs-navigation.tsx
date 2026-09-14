'use client';

import React from 'react';

import { cn } from '@/lib/utils';
import { TabItem, useTabs } from '@/hooks/use-tabs';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface TabsNavigationProps<T extends string = string> {
  tabs: TabItem<T>[];
  /** URL query parameter name used to track the active tab. Defaults to `"tab"`. */
  tabQueryName?: string;
  /** The tab value to activate when no query param is present. Defaults to the first tab. */
  defaultTab?: T;
  className?: string;
  listClassName?: string;
  contentClassName?: string;
}

export function TabsNavigation<T extends string = string>({
  tabs,
  tabQueryName = 'tab',
  defaultTab,
  className,
  listClassName,
  contentClassName,
}: TabsNavigationProps<T>) {
  const { activeTab, setTab } = useTabs({ tabs, tabQueryName, defaultTab });

  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setTab(v as T)}
      className={cn('w-full space-y-5', className)}
    >
      <TabsList className={listClassName}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className={contentClassName}
        >
          {tab.component}
        </TabsContent>
      ))}
    </Tabs>
  );
}
