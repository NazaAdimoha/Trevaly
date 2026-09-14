'use client';

import { format } from 'date-fns';
import { CalendarDays } from 'lucide-react';
import React, { useState } from 'react';
import type { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';

import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

import { fieldContainerVariants, FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

export type { DateRange };

export interface DateRangeFieldProps {
  id: string;
  label?: string;
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  fieldSize?: FieldSize;
  className?: string;
}

export function DateRangeField({
  id,
  label,
  value,
  onChange,
  placeholder = 'Select date range',
  disabled,
  fieldSize = 'sm',
  className,
}: DateRangeFieldProps) {
  const [open, setOpen] = useState(false);

  const formatted =
    value?.from && value?.to
      ? `${format(value.from, 'dd-MM-yyyy')} – ${format(
          value.to,
          'dd-MM-yyyy',
        )}`
      : value?.from
        ? `${format(value.from, 'dd-MM-yyyy')} – ...`
        : null;

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
              'cursor-pointer justify-start gap-2 px-3 text-left',
              disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
              !formatted && 'text-grey-400',
              className,
            )}
          >
            <CalendarDays className='text-primary h-4 w-4 shrink-0' />
            <span className='truncate'>{formatted ?? placeholder}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent
          className='w-auto border-0 bg-white p-0 shadow-md'
          align='start'
        >
          <Calendar
            mode='range'
            selected={value}
            onSelect={(range) => {
              onChange(range);
            }}
            captionLayout='dropdown-years'
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}
