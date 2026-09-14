import React from 'react';

import { cn } from '@/lib/utils';

export interface KeyValueRow {
  label: string;
  value: React.ReactNode;
}

interface KeyValueTableProps {
  rows: KeyValueRow[];
  labelWidth?: string;
  className?: string;
}

export function KeyValueTable({
  rows,
  labelWidth = 'w-48',
  className,
}: KeyValueTableProps) {
  return (
    <div className={cn('overflow-hidden rounded-lg', className)}>
      {rows.map((row, index) => (
        <div
          key={index}
          className={cn(
            'flex items-start gap-6 px-6 py-4',
            index % 2 === 0 ? 'bg-white' : 'bg-grey-50',
          )}
        >
          <span className={cn('text-grey-500 shrink-0 text-sm', labelWidth)}>
            {row.label}:
          </span>
          <div className='text-grey-900 flex-1 text-sm'>{row.value}</div>
        </div>
      ))}
    </div>
  );
}
