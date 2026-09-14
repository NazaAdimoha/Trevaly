'use client';

import { SlidersHorizontal, X } from 'lucide-react';
import React, { useState } from 'react';

import Button from '@/components/buttons/Button';
import { SearchInput } from '@/components/fields/SearchInput';

export interface FilterPanelProps {
  children?: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  showFilterButton?: boolean;
}

export function FilterPanel({
  children,
  onApply,
  onReset,
  showSearch = false,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search',
  showFilterButton = true,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);

  const handleApply = () => {
    onApply?.();
    setOpen(false);
  };

  const handleReset = () => {
    onReset?.();
  };

  return (
    <div className='flex items-center gap-3'>
      {showSearch && (
        <SearchInput
          id='filter-search'
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      )}

      {showFilterButton && (
        <div className='relative'>
          <Button
            variant='secondary'
            size='xl'
            leftIcon={SlidersHorizontal}
            onClick={() => setOpen(true)}
          >
            Filter
          </Button>

          {open && (
            <>
              {/* Backdrop */}
              <div
                className='fixed inset-0 z-40 bg-black/20'
                onClick={() => setOpen(false)}
              />

              {/* Panel */}
              <div className='absolute top-full right-0 z-50 mt-2 min-w-96 rounded-lg bg-white shadow-xl'>
                {/* Header */}
                <div className='border-grey-50 flex items-center justify-between border-b px-5 py-4'>
                  <h3 className='text-grey-900 text-xl font-medium'>Filter</h3>
                  <button
                    onClick={() => setOpen(false)}
                    className='bg-primary flex h-6 w-6 items-center justify-center rounded-full text-white focus:outline-none'
                    aria-label='Close filter panel'
                  >
                    <X className='h-3.5 w-3.5' />
                  </button>
                </div>

                {/* Filter fields */}
                {children && (
                  <div className='space-y-4 px-5 pt-3 pb-4'>{children}</div>
                )}

                {/* Actions */}
                <div className='shadow-filter flex justify-end gap-3 px-5 py-4'>
                  <Button variant='default' size='m' onClick={handleReset}>
                    Reset
                  </Button>
                  <Button variant='primary' size='m' onClick={handleApply}>
                    Apply Filters
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
