'use client';

import { useField } from 'formik';
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

export interface DateFieldProps {
  name: string;
  label?: string;
  subtitle?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  disabled?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  className?: string;
  startMonth?: Date;
  endMonth?: Date;
  validate?: (value: Date | null) => string | undefined;
}

export function DateField({
  name,
  label,
  subtitle,
  placeholder = 'Select a date',
  required,
  hint,
  success,
  disabled,
  fieldSize = 'sm',
  wrapperClassName,
  className,
  startMonth,
  endMonth = new Date(new Date().getFullYear() + 100, 12),
  validate,
}: DateFieldProps) {
  const [field, meta, helpers] = useField<Date | null>({ name, validate });
  const [open, setOpen] = useState(false);

  const showError = !!(meta.touched && meta.error);
  const state = showError ? 'error' : 'default';

  const formatted = field.value
    ? field.value.toLocaleDateString('en-US', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const handleSelect = (date: Date | undefined) => {
    helpers.setValue(date ?? null);
    helpers.setTouched(true, false);
    if (date) setOpen(false);
  };

  return (
    <FieldWrapper
      name={name}
      label={label}
      subtitle={subtitle}
      required={required}
      hint={hint}
      success={success}
      error={meta.error}
      touched={meta.touched}
      className={wrapperClassName}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={name}
            type='button'
            disabled={disabled}
            aria-describedby={
              showError ? `${name}-error` : hint ? `${name}-hint` : undefined
            }
            className={cn(
              fieldContainerVariants({ fieldSize, state }),
              'cursor-pointer justify-start gap-2 px-3 text-left',
              disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
              !formatted && 'text-grey-400',
              className,
            )}
          >
            <CalendarDays className='text-primary h-4 w-4 shrink-0' />
            <span
              className={cn(
                'text-sm',
                formatted && 'text-dark-100',
                placeholder && !formatted && 'text-grey-400',
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
            selected={field.value ?? undefined}
            defaultMonth={field.value ?? undefined}
            onSelect={handleSelect}
            captionLayout='dropdown-years'
            disabled={{
              before: startMonth,
              after: endMonth,
            }}
            {...(startMonth && { startMonth })}
            {...(endMonth && { endMonth })}
          />
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}
