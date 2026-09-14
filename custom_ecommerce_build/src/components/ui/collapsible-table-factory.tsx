'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type ColumnAlign = 'left' | 'center' | 'right';

export interface CollapsibleColumn<T> {
  header: string;
  key: string;
  accessor?: keyof T | ((row: T, level: number) => React.ReactNode);
  expandable?: boolean;
  align?: ColumnAlign;
  width?: string | number;
  minWidth?: string | number;
}

export interface CollapsibleTableFactoryProps<T> {
  columns: CollapsibleColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string | number;
  getChildren?: (row: T) => T[] | undefined;
  rowClassName?: (row: T, level: number) => string;
  indentPx?: number;
  defaultExpanded?: boolean;
  isLoading?: boolean;
  loadingRows?: number;
  emptyState?: React.ReactNode;
  className?: string;
}

function defaultGetChildren<T>(row: T): T[] | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any).children as T[] | undefined;
}

function renderCellContent<T>(
  col: CollapsibleColumn<T>,
  row: T,
  level: number,
): React.ReactNode {
  if (!col.accessor) return null;
  if (typeof col.accessor === 'function') return col.accessor(row, level);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any)[col.accessor] as React.ReactNode;
}

interface CollapsibleRowProps<T> {
  row: T;
  level: number;
  columns: CollapsibleColumn<T>[];
  getRowKey: (row: T) => string | number;
  getChildren: (row: T) => T[] | undefined;
  rowClassName?: (row: T, level: number) => string;
  indentPx: number;
  defaultExpanded: boolean;
}

function CollapsibleRow<T>({
  row,
  level,
  columns,
  getRowKey,
  getChildren,
  rowClassName,
  indentPx,
  defaultExpanded,
}: CollapsibleRowProps<T>) {
  const [isOpen, setIsOpen] = useState(defaultExpanded);
  const children = getChildren(row);
  const hasChildren = !!children?.length;

  return (
    <>
      <TableRow
        className={cn('border-grey-50 border-b', rowClassName?.(row, level))}
      >
        {columns.map((col) => (
          <TableCell
            key={col.key}
            align={col.align}
            style={{ width: col.width, minWidth: col.minWidth }}
          >
            {col.expandable ? (
              <div
                className='flex min-w-0 items-center gap-1.5'
                style={{ paddingLeft: level * indentPx }}
              >
                {hasChildren ? (
                  <button
                    type='button'
                    aria-label={isOpen ? 'Collapse' : 'Expand'}
                    className='hover:bg-grey-100 flex-shrink-0 rounded p-0.5 transition-colors'
                    onClick={() => setIsOpen((prev) => !prev)}
                  >
                    {isOpen ? (
                      <ChevronDown className='text-grey-500 h-4 w-4' />
                    ) : (
                      <ChevronRight className='text-grey-500 h-4 w-4' />
                    )}
                  </button>
                ) : (
                  <span className='w-5 flex-shrink-0' aria-hidden='true' />
                )}
                <span className='truncate'>
                  {renderCellContent(col, row, level)}
                </span>
              </div>
            ) : (
              renderCellContent(col, row, level)
            )}
          </TableCell>
        ))}
      </TableRow>

      {hasChildren &&
        isOpen &&
        children?.map((child) => (
          <CollapsibleRow
            key={getRowKey(child)}
            row={child}
            level={level + 1}
            columns={columns}
            getRowKey={getRowKey}
            getChildren={getChildren}
            rowClassName={rowClassName}
            indentPx={indentPx}
            defaultExpanded={defaultExpanded}
          />
        ))}
    </>
  );
}

function CollapsibleTableFactory<T>({
  columns,
  data,
  getRowKey,
  getChildren = defaultGetChildren,
  rowClassName,
  indentPx = 20,
  defaultExpanded = false,
  isLoading = false,
  loadingRows = 6,
  emptyState,
  className,
}: CollapsibleTableFactoryProps<T>) {
  return (
    <div
      className={cn(
        'rounded-base border-grey-50 w-full overflow-auto border bg-white',
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className='hover:bg-grey-50/40'>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                align={col.align}
                style={{ width: col.width, minWidth: col.minWidth }}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {isLoading &&
            Array.from({ length: loadingRows }).map((_, i) => (
              <TableRow key={i} className='border-grey-50 border-b'>
                {columns.map((col) => (
                  <TableCell key={col.key}>
                    <Skeleton className='h-5 w-full' />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!isLoading && data.length === 0 && (
            <TableRow className='hover:bg-transparent'>
              <TableCell
                colSpan={columns.length}
                align='center'
                className='text-grey-500 py-12'
              >
                {emptyState ?? 'No data available.'}
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            data.map((row) => (
              <CollapsibleRow
                key={getRowKey(row)}
                row={row}
                level={0}
                columns={columns}
                getRowKey={getRowKey}
                getChildren={getChildren}
                rowClassName={rowClassName}
                indentPx={indentPx}
                defaultExpanded={defaultExpanded}
              />
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { CollapsibleTableFactory };
