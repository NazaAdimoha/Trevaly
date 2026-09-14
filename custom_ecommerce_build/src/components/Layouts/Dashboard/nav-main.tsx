'use client';

import {
  Building2,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Percent,
  Receipt,
  Settings,
  Truck,
  Webhook,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import type { NavIcon, NavItem } from '@/constant/menu';

/**
 * Icon names to components.
 *
 * This lives here rather than in `@/constant/menu` because the menus are
 * assembled in Server Components: a component reference cannot cross that
 * boundary, so the server sends a name and the resolution happens on the
 * client, where holding the function is fine.
 */
const NAV_ICONS: Record<NavIcon, LucideIcon> = {
  overview: LayoutDashboard,
  products: Package,
  orders: Receipt,
  coupons: Percent,
  delivery: Truck,
  settings: Settings,
  tenants: Building2,
  webhooks: Webhook,
};

export function NavMain({ items }: { items: NavItem[] }) {
  const { state } = useSidebar();
  const pathname = usePathname();

  /**
   * Active state is matched on the segment after the store slug, not on the
   * full path — `/dashboard/stores/adaobi-store/products/abc/edit` must still
   * light up "Products".
   */
  const currentKey = (() => {
    const parts = pathname.split('/').filter(Boolean);
    // dashboard / stores / {slug} / {key}
    if (parts[0] === 'dashboard' && parts[1] === 'stores')
      return parts[3] ?? '';
    if (parts[0] === 'dashboard' && parts[1] === 'platform')
      return parts[2] ?? '';
    return '';
  })();

  return (
    <SidebarGroup className={cn('px-4 py-6', state === 'collapsed' && 'p-2')}>
      <SidebarMenu className='space-y-2'>
        {items.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                size='lg'
                asChild
                isActive={item.key === currentKey}
              >
                <Link href={item.url}>
                  <Icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
