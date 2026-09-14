'use client';

import { Store } from 'lucide-react';
import Link from 'next/link';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar';

import type { NavItem } from '@/constant/menu';
import ROUTES from '@/constant/routes';

import { NavMain } from './nav-main';

export function AppSidebar({
  items,
  storeName,
  storeSlug,
}: {
  items: NavItem[];
  storeName: string;
  storeSlug?: string;
}) {
  return (
    <Sidebar collapsible='icon'>
      <SidebarHeader className='px-4 py-5'>
        <Link href={ROUTES.dashboard.base} className='flex items-center gap-2'>
          <Store className='size-5 shrink-0' />
          <span className='truncate font-medium group-data-[collapsible=icon]:hidden'>
            {storeName}
          </span>
        </Link>
        {storeSlug ? (
          <span className='truncate text-xs text-gray-500 group-data-[collapsible=icon]:hidden'>
            {storeSlug}
          </span>
        ) : null}
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>

      <SidebarFooter className='px-4 py-4'>
        <Link
          href={ROUTES.dashboard.base}
          className='truncate text-xs text-gray-500 group-data-[collapsible=icon]:hidden hover:underline'
        >
          Switch store
        </Link>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
