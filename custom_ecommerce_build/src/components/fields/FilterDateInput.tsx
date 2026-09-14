'use client';

import { CalendarDays } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { fieldContainerVariants, FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

export interface FilterDateInputProps {
  id: string;
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  fieldSize?: FieldSize;
  className?: string;
}

export function FilterDateInput({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select a date',
  disabled,
  fieldSize = 'sm',
  className,
}: FilterDateInputProps) {
  const [open, setOpen] = useState(false);

  const formatted = value
    ? value.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const handleSelect = (date: Date | undefined) => {
    onChange(date ?? null);
    if (date) setOpen(false);
  };

  return (
    <FieldWrapper name={id} label={label}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type='button'
            disabled={disabled}
            className={cn(
              fieldContainerVariants({ fieldSize }),
              'w-full cursor-pointer justify-start gap-2 px-3 text-left',
              disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
              !formatted && 'text-grey-400',
              className,
            )}
          >
            <CalendarDays className='text-primary h-4 w-4 shrink-0' />
            <span
              className={cn(
                'text-sm',
                formatted ? 'text-dark-100' : 'text-grey-400',
              )}
            >
              {formatted ?? placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto border-0 bg-white p-0 shadow-md'
          align='start'
        >
          <Calendar
            mode='single'
            selected={value ?? undefined}
            defaultMonth={value ?? undefined}
            onSelect={handleSelect}
            captionLayout='dropdown-years'
          />
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}
