import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

import { ButtonProps, buttonVariants } from '@/components/ui/button';

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role='navigation'
    aria-label='pagination'
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
);
Pagination.displayName = 'Pagination';

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    className={cn('flex flex-row items-center gap-1', className)}
    {...props}
  />
));
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn('', className)} {...props} />
));
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<ButtonProps, 'size'> &
  React.ComponentProps<'a'>;

const PaginationLink = ({
  className,
  isActive,
  size = 'icon',
  ...props
}: PaginationLinkProps) => (
  <a
    aria-current={isActive ? 'page' : undefined}
    className={cn(
      buttonVariants({
        variant: isActive ? 'outline' : 'ghost',
        size,
      }),
      className,
    )}
    {...props}
  />
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to previous page'
    size='m'
    className={cn('gap-1 pl-2.5', className)}
    {...props}
  >
    <ChevronLeft className='h-4 w-4' />
    <span>Previous</span>
  </PaginationLink>
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = ({
  className,
  ...props
}: React.ComponentProps<typeof PaginationLink>) => (
  <PaginationLink
    aria-label='Go to next page'
    size='m'
    className={cn('gap-1 pr-2.5', className)}
    {...props}
  >
    <span>Next</span>
    <ChevronRight className='h-4 w-4' />
  </PaginationLink>
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({
  className,
  ...props
}: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex h-9 w-9 items-center justify-center', className)}
    {...props}
  >
    <MoreHorizontal className='h-4 w-4' />
    <span className='sr-only'>More pages</span>
  </span>
);
PaginationEllipsis.displayName = 'PaginationEllipsis';

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};
export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pages: (number | 'ellipsis')[];
  className?: string;
}

const TablePagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pages,
  className,
}: TablePaginationProps) => {
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= totalPages;

  return (
    <nav
      role='navigation'
      aria-label='Table pagination'
      className={cn(
        'border-grey-50 flex w-full items-center justify-between border-t pt-3',
        className,
      )}
    >
      <button
        onClick={() => !isPrevDisabled && onPageChange(currentPage - 1)}
        disabled={isPrevDisabled}
        className={cn(
          'flex items-center gap-1 text-sm font-medium transition-colors',
          isPrevDisabled
            ? 'text-grey-200 cursor-not-allowed'
            : 'text-grey-500 hover:text-grey-900 cursor-pointer',
        )}
        aria-label='Go to previous page'
      >
        <ArrowLeft className='h-4 w-4' />
        Previous
      </button>

      <ul className='flex flex-row items-center gap-1'>
        {pages.map((page, idx) =>
          page === 'ellipsis' ? (
            <li key={`ellipsis-${idx}`}>
              <span className='text-grey-400 flex h-9 w-9 items-center justify-center'>
                <MoreHorizontal className='h-4 w-4' />
                <span className='sr-only'>More pages</span>
              </span>
            </li>
          ) : (
            <li key={page}>
              <button
                onClick={() => onPageChange(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md text-xs font-normal transition-colors',
                  page === currentPage
                    ? 'bg-primary-50 text-primary-700 font-semibold'
                    : 'text-grey-500 hover:bg-grey-50',
                )}
              >
                {page}
              </button>
            </li>
          ),
        )}
      </ul>

      <button
        onClick={() => !isNextDisabled && onPageChange(currentPage + 1)}
        disabled={isNextDisabled}
        className={cn(
          'flex items-center gap-1 text-sm font-medium transition-colors',
          isNextDisabled
            ? 'text-grey-200 cursor-not-allowed'
            : 'text-grey-500 hover:text-grey-900 cursor-pointer',
        )}
        aria-label='Go to next page'
      >
        Next
        <ArrowRight className='h-4 w-4' />
      </button>
    </nav>
  );
};
TablePagination.displayName = 'TablePagination';

export { TablePagination };
