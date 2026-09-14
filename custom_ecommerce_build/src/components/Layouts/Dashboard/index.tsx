'use client';

import type { ReactNode } from 'react';

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';

import type { NavItem } from '@/constant/menu';

import { AppSidebar } from './app-sidebar';

/**
 * Dashboard shell. Authorization happens in the Server Component layouts above
 * this — never here, because a client component cannot be trusted to enforce it.
 */
export default function DashboardLayout({
  children,
  items,
  storeName,
  storeSlug,
}: {
  children: ReactNode;
  items: NavItem[];
  storeName: string;
  storeSlug?: string;
}) {
  return (
    <TooltipProvider delayDuration={0}>
      <SidebarProvider>
        <AppSidebar items={items} storeName={storeName} storeSlug={storeSlug} />
        <SidebarInset>
          <div className='flex flex-1 flex-col gap-5 bg-gray-50'>
            {/* Account controls live in the `/dashboard` layout above this, so
                every authenticated screen has them — not just this shell. */}
            <header className='flex items-center border-b bg-white px-6 py-3'>
              <SidebarTrigger />
            </header>
            <div className='px-6 pb-8'>{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
