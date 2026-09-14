'use client';

import { MoreVertical } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TableActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  separator?: boolean;
}

export interface TableActionMenuProps {
  items: TableActionItem[];
  triggerLabel?: string;
}

export function TableActionMenu({
  items,
  triggerLabel = 'Row actions',
}: TableActionMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div
          className='bg-dark-100/20 fixed inset-0 z-40 transition duration-300 ease-in-out'
          onClick={() => setOpen(false)}
        />
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className='hover:bg-grey-50 rounded p-1.5 focus:outline-none'
            aria-label={triggerLabel}
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className='text-grey-600 h-4 w-4' />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align='end'
          className='relative z-50 bg-white p-2'
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => (
            <React.Fragment key={idx}>
              {item.separator && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className={cn(
                  'hover:bg-grey-50 cursor-pointer rounded px-1 py-2 transition-colors duration-200 ease-in',
                  item.variant === 'destructive' && 'text-error',
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                  setOpen(false);
                }}
              >
                {item.icon && (
                  <span className='flex size-5 shrink-0 items-center'>
                    {item.icon}
                  </span>
                )}
                <span className='text-grey-800 text-base'>{item.label}</span>
              </DropdownMenuItem>
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
