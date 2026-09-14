'use client';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import * as React from 'react';

import { getPaginationPages, paginateItems } from '@/lib/helper';
import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';
import { TablePagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type ColumnAlign = 'left' | 'center' | 'right';

export type SortDirection = 'asc' | 'desc';

export type SortValue = string | number | Date | null | undefined;

export interface IColumn<T> {
  /** Text shown in the header cell. */
  header: string;
  /** Unique identifier for this column. Also passed to `onCellAction`. */
  key: string;
  /**
   * How to resolve the cell value.
   * - `keyof T` — reads that property off the row
   * - `(row, triggerAction?) => ReactNode` — full render function
   */
  accessor?:
    keyof T | ((row: T, triggerAction?: () => void) => React.ReactNode);
  /** Render override that takes priority over `accessor`. */
  actions?: (row: T, triggerAction?: () => void) => React.ReactNode;
  /** Horizontal alignment of header and cell content. Defaults to `"left"`. */
  align?: ColumnAlign;
  /** CSS width (e.g. `"120px"`, `"10%"`). Applied via inline style. */
  width?: string | number;
  /** CSS min-width. Applied via inline style. */
  minWidth?: string | number;
  /** When true the column is excluded from render entirely. */
  hidden?: boolean;
  /**
   * Marks this column as sortable. Header becomes a toggle button that
   * cycles asc → desc → cleared. Client-side only; ignored when the caller
   * uses backend pagination (`currentPage` + `onPageChange`).
   */
  sortable?: boolean;
  /**
   * Optional value extractor used when sorting. Falls back to `accessor`
   * when it is a `keyof T`. Non-comparable rows sort last.
   */
  sortAccessor?: (row: T) => SortValue;
}

export interface TableFactoryProps<T> {
  columns: IColumn<T>[];
  data: T[];
  /**
   * Stable key for each row.
   * - `keyof T` — uses that property value as the key
   * - `(row: T) => string | number` — derive the key yourself
   * Falls back to row index when omitted.
   */
  rowKey?: keyof T | ((row: T) => string | number);
  isLoading?: boolean;
  /** Number of skeleton rows to show while loading. Defaults to 8. */
  loadingRows?: number;
  /** Rendered when `data` is empty and `isLoading` is false. */
  emptyState?: React.ReactNode;
  /** Called when a row is clicked. Adds `cursor-pointer` to all rows. */
  onRowClick?: (row: T) => void;
  /**
   * Called when a cell's built-in `triggerAction` callback is invoked.
   * Receives the column key and the full row.
   */
  onCellAction?: (columnKey: string, row: T) => void;
  /** Sticks the header row to the top during scroll. */
  stickyHeader?: boolean;
  /** Caption text rendered below the table (also used as `aria-label`). */
  caption?: string;
  /** Enables a checkbox column for row selection. */
  selectable?: boolean;
  /** Where to render the checkbox column. Defaults to `"start"`. */
  checkboxPosition?: 'start' | 'end';
  /**
   * Controlled array of selected row keys.
   * Pair with `rowKey` for stable identity; falls back to row index.
   */
  selectedKeys?: (string | number)[];
  /** Fired whenever the selection changes. Receives the full updated key array. */
  onSelectionChange?: (keys: (string | number)[]) => void;
  /** Applied to the outermost wrapper `<div>`. */
  className?: string;
  /** Applied directly to the `<table>` element. */
  tableClassName?: string;
  /** Removes the default rounded border shell so table can blend into a parent card. */
  unstyledContainer?: boolean;
  /** Removes the default highlighted header background. */
  plainHeader?: boolean;
  /**
   * Items per page. When set, enables pagination UI.
   * FE pagination slices `data` locally; for BE pagination pair with
   * `currentPage`, `totalItems`, and `onPageChange`.
   */
  pageSize?: number;
  /** Controlled current page for BE-side pagination (1-based). */
  currentPage?: number;
  /** Total item count from the server, used to compute total pages in BE mode. */
  totalItems?: number;
  /** Called when the user navigates to a different page. Use this for BE-side fetching. */
  onPageChange?: (page: number) => void;
  /**
   * Initial client-side sort. Only applied when the referenced column has
   * `sortable: true` and BE pagination is not active.
   */
  defaultSort?: { key: string; direction: SortDirection };
  /**
   * Optional footer rows rendered after all data rows.
   * Each entry maps its `cells` array 1-to-1 with visible columns.
   * Cells can be any ReactNode; nullish values render an empty cell.
   */
  footerRows?: { cells: React.ReactNode[]; className?: string }[];
}

function resolveRowKey<T>(
  row: T,
  index: number,
  rowKey?: TableFactoryProps<T>['rowKey'],
): string | number {
  if (!rowKey) return index;
  if (typeof rowKey === 'function') return rowKey(row);
  return row[rowKey] as string | number;
}

function renderCell<T>(
  col: IColumn<T>,
  row: T,
  onTrigger: (key: string, row: T) => void,
): React.ReactNode {
  const trigger = () => onTrigger(col.key, row);

  if (col.actions) return col.actions(row, trigger);
  if (!col.accessor) return null;
  if (typeof col.accessor === 'function') return col.accessor(row, trigger);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (row as any)[col.accessor] as React.ReactNode;
}

function resolveSortValue<T>(col: IColumn<T>, row: T): SortValue {
  if (col.sortAccessor) return col.sortAccessor(row);
  if (col.accessor && typeof col.accessor !== 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (row as any)[col.accessor] as SortValue;
  }
  return undefined;
}

function compareSortValues(a: SortValue, b: SortValue): number {
  const aNil = a === null || a === undefined;
  const bNil = b === null || b === undefined;
  if (aNil && bNil) return 0;
  if (aNil) return 1; // nulls last
  if (bNil) return -1;

  if (a instanceof Date && b instanceof Date) {
    return a.getTime() - b.getTime();
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function TableFactory<T>({
  columns,
  data,
  rowKey,
  isLoading = false,
  loadingRows = 8,
  emptyState,
  onRowClick,
  onCellAction,
  stickyHeader = false,
  caption,
  selectable = false,
  checkboxPosition = 'start',
  selectedKeys,
  onSelectionChange,
  className,
  tableClassName,
  unstyledContainer = false,
  plainHeader = false,
  pageSize = 10,
  currentPage,
  totalItems,
  onPageChange,
  defaultSort,
  footerRows,
}: TableFactoryProps<T>) {
  const visibleColumns = columns.filter((col) => !col.hidden);

  // ---- Pagination ----
  const isBEPagination =
    currentPage !== undefined && onPageChange !== undefined;
  const [internalPage, setInternalPage] = React.useState(1);

  // ---- Client-side sort (ignored when BE pagination is active) ----
  const [sort, setSort] = React.useState<{
    key: string;
    direction: SortDirection;
  } | null>(defaultSort ?? null);

  const sortedData = React.useMemo(() => {
    if (isBEPagination || !sort) return data;
    const col = visibleColumns.find((c) => c.key === sort.key);
    if (!col || !col.sortable) return data;
    const indexed = data.map((row, index) => ({ row, index }));
    indexed.sort((a, b) => {
      const cmp = compareSortValues(
        resolveSortValue(col, a.row),
        resolveSortValue(col, b.row),
      );
      if (cmp !== 0) return sort.direction === 'asc' ? cmp : -cmp;
      return a.index - b.index; // stable
    });
    return indexed.map((entry) => entry.row);
  }, [data, sort, isBEPagination, visibleColumns]);

  const handleSortToggle = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key, direction: 'desc' };
      return null;
    });
    setInternalPage(1);
  };

  // Reset to page 1 whenever the data set changes (e.g. after a filter/search).
  React.useEffect(() => {
    setInternalPage(1);
  }, [data]);

  const activePage = isBEPagination ? (currentPage ?? 1) : internalPage;
  const totalCount = isBEPagination
    ? (totalItems ?? sortedData.length)
    : sortedData.length;
  const totalPages = pageSize
    ? Math.max(1, Math.ceil(totalCount / pageSize))
    : 1;

  const displayData =
    pageSize && !isBEPagination
      ? paginateItems(sortedData, activePage, pageSize)
      : sortedData;

  const paginationPages = pageSize
    ? getPaginationPages(activePage, totalPages)
    : [];

  const handlePageChange = (page: number) => {
    if (isBEPagination) {
      onPageChange?.(page);
    } else {
      setInternalPage(page);
    }
  };

  // ---- Selection helpers ----
  const selectedSet = React.useMemo(
    () => new Set(selectedKeys ?? []),
    [selectedKeys],
  );

  const rowKeys = React.useMemo(
    () => displayData.map((row, i) => resolveRowKey(row, i, rowKey)),
    [displayData, rowKey],
  );

  const allSelected =
    selectable &&
    rowKeys.length > 0 &&
    rowKeys.every((k) => selectedSet.has(k));
  const someSelected =
    selectable && rowKeys.some((k) => selectedSet.has(k)) && !allSelected;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    onSelectionChange(allSelected ? [] : rowKeys);
  };

  const toggleRow = (key: string | number) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onSelectionChange(Array.from(next));
  };

  const handleTrigger = (columnKey: string, row: T) => {
    onCellAction?.(columnKey, row);
  };

  // ---- Checkbox cell widths ----
  const checkboxHeadCell = selectable ? (
    <TableHead key='__checkbox' align='center' className='w-10 px-3'>
      <Checkbox
        checked={allSelected ? true : someSelected ? 'indeterminate' : false}
        onCheckedChange={toggleAll}
        aria-label='Select all rows'
      />
    </TableHead>
  ) : null;

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'overflow-auto',
          !unstyledContainer && 'rounded-base border-grey-50 border',
          stickyHeader &&
            '[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-10',
        )}
      >
        <Table
          aria-busy={isLoading}
          aria-label={caption}
          className={tableClassName}
        >
          {caption && <TableCaption>{caption}</TableCaption>}

          <TableHeader>
            <TableRow>
              {checkboxPosition === 'start' && checkboxHeadCell}
              {visibleColumns.map((col) => {
                const isSortable = !!col.sortable && !isBEPagination;
                const activeSort =
                  isSortable && sort && sort.key === col.key ? sort : null;
                const SortIcon = activeSort
                  ? activeSort.direction === 'asc'
                    ? ArrowUp
                    : ArrowDown
                  : ArrowUpDown;
                return (
                  <TableHead
                    key={col.key}
                    align={col.align}
                    className={cn(
                      plainHeader && 'border-grey-50 border-y bg-transparent',
                    )}
                    style={{ width: col.width, minWidth: col.minWidth }}
                    aria-sort={
                      activeSort
                        ? activeSort.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : isSortable
                          ? 'none'
                          : undefined
                    }
                  >
                    {isSortable ? (
                      <button
                        type='button'
                        onClick={() => handleSortToggle(col.key)}
                        className={cn(
                          'inline-flex items-center gap-1 select-none',
                          'hover:text-primary-600 focus:outline-none',
                          activeSort && 'text-primary-600',
                        )}
                      >
                        <span>{col.header}</span>
                        <SortIcon
                          className={cn(
                            'h-3.5 w-3.5',
                            !activeSort && 'opacity-50',
                          )}
                          aria-hidden='true'
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                );
              })}
              {checkboxPosition === 'end' && checkboxHeadCell}
            </TableRow>
          </TableHeader>

          <TableBody>
            {/* ---- Loading state ---- */}
            {isLoading &&
              Array.from({ length: loadingRows }).map((_, rowIdx) => {
                const skeletonColCount =
                  visibleColumns.length + (selectable ? 1 : 0);
                return (
                  <TableRow key={rowIdx} className='border-grey-50 border-b'>
                    {Array.from({ length: skeletonColCount }).map((__, ci) => (
                      <TableCell key={ci}>
                        <Skeleton className='h-5 w-full' />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

            {/* ---- Empty state ---- */}
            {!isLoading && data.length === 0 && (
              <TableRow className='hover:bg-transparent'>
                <TableCell
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  align='center'
                  className='text-grey-500 py-12'
                >
                  {emptyState ?? 'No data available.'}
                </TableCell>
              </TableRow>
            )}

            {/* ---- Data rows ---- */}
            {!isLoading &&
              displayData.length > 0 &&
              displayData.map((row, i) => {
                const key = resolveRowKey(row, i, rowKey);
                const isSelected = selectedSet.has(key);

                const checkboxDataCell = selectable ? (
                  <TableCell
                    key='__checkbox'
                    align='center'
                    className='w-10 px-3'
                    // Stop row click from firing when clicking the checkbox
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(key)}
                      aria-label='Select row'
                    />
                  </TableCell>
                ) : null;

                return (
                  <TableRow
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    data-state={isSelected ? 'selected' : undefined}
                    className={cn(
                      'border-grey-50 border-b',
                      'bg-white',
                      isSelected && 'bg-primary-50/40 even:bg-primary-50/40',
                      onRowClick && 'hover:bg-primary-50/60 cursor-pointer',
                      !onRowClick && 'hover:bg-grey-50/60',
                    )}
                  >
                    {checkboxPosition === 'start' && checkboxDataCell}
                    {visibleColumns.map((col) => (
                      <TableCell key={col.key} align={col.align}>
                        {renderCell(col, row, handleTrigger)}
                      </TableCell>
                    ))}
                    {checkboxPosition === 'end' && checkboxDataCell}
                  </TableRow>
                );
              })}
            {/* ---- Footer rows ---- */}
            {!isLoading &&
              footerRows &&
              footerRows.map((footerRow, rowIdx) => (
                <TableRow
                  key={`__footer_${rowIdx}`}
                  className={cn(
                    'border-grey-100 border-t-2 bg-white hover:bg-white',
                    footerRow.className,
                  )}
                >
                  {checkboxPosition === 'start' && selectable && <TableCell />}
                  {visibleColumns.map((col, colIdx) => (
                    <TableCell key={col.key} align={col.align}>
                      {footerRow.cells[colIdx] ?? null}
                    </TableCell>
                  ))}
                  {checkboxPosition === 'end' && selectable && <TableCell />}
                </TableRow>
              ))}
          </TableBody>
        </Table>
        {pageSize && totalPages > 1 && (
          <TablePagination
            currentPage={activePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            pages={paginationPages}
            className='px-4 pb-3'
          />
        )}
      </div>
    </div>
  );
}

export { TableFactory };
