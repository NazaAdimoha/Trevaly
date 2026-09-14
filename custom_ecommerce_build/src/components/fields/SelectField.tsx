'use client';

import { useField } from 'formik';
import { Loader2, Search, X } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { fieldContainerVariants, FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

export interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface SelectOptionGroup {
  groupLabel: string;
  options: SelectOption[];
}

export type SelectOptionOrGroup = SelectOption | SelectOptionGroup;

function isGroup(item: SelectOptionOrGroup): item is SelectOptionGroup {
  return 'groupLabel' in item;
}

function filterOptions(
  options: SelectOptionOrGroup[],
  query: string,
): SelectOptionOrGroup[] {
  if (!query) return options;
  const lower = query.toLowerCase();
  return options.flatMap((item): SelectOptionOrGroup[] => {
    if (isGroup(item)) {
      const filtered = item.options.filter((o) =>
        o.label.toLowerCase().includes(lower),
      );
      return filtered.length ? [{ ...item, options: filtered }] : [];
    }
    return item.label.toLowerCase().includes(lower) ? [item] : [];
  });
}

export interface SelectFieldProps {
  name: string;
  options: SelectOptionOrGroup[];
  label?: string;
  subtitle?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  disabled?: boolean;
  loading?: boolean;
  isSearchable?: boolean;
  clearable?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  className?: string;
}

export function SelectField({
  name,
  options,
  label,
  subtitle,
  placeholder = 'Select an option',
  required,
  hint,
  success,
  disabled,
  loading,
  isSearchable = false,
  fieldSize = 'sm',
  wrapperClassName,
  className,
}: SelectFieldProps) {
  const [field, meta, helpers] = useField<string>(name);
  const [search, setSearch] = useState('');

  const showError = !!(meta.touched && meta.error);
  const state = showError ? 'error' : 'default';

  const handleValueChange = (value: string) => {
    helpers.setValue(value);
    helpers.setTouched(true, false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    helpers.setValue('');
    helpers.setTouched(true, false);
  };

  const visible = isSearchable ? filterOptions(options, search) : options;

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
      <div className='relative'>
        <Select
          key={loading ? 'loading' : 'loaded'}
          value={field.value ?? ''}
          onValueChange={handleValueChange}
          disabled={disabled || loading}
        >
          <SelectTrigger
            id={name}
            className={cn(
              fieldContainerVariants({ fieldSize, state }),
              'w-full',
              (disabled || loading) &&
                'bg-grey-50 cursor-not-allowed opacity-75',
              !field.value && 'text-grey-400',
              className,
            )}
            aria-describedby={
              showError ? `${name}-error` : hint ? `${name}-hint` : undefined
            }
            aria-invalid={showError ? true : undefined}
          >
            {loading ? (
              <div className='text-grey-400 flex items-center gap-2'>
                <Loader2 className='h-4 w-4 animate-spin' />
                <span> Loading...</span>
              </div>
            ) : (
              <SelectValue placeholder={placeholder} />
            )}
          </SelectTrigger>

          <SelectContent className='max-h-60 bg-white'>
            {isSearchable && (
              <div className='border-grey-50 flex items-center gap-2 border-b px-2 py-1.5'>
                <Search className='text-grey-400 h-3.5 w-3.5 shrink-0' />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder='Search...'
                  className='placeholder:text-grey-400 flex-1 bg-transparent text-sm outline-none'
                />
              </div>
            )}
            {visible.map((item, idx) =>
              isGroup(item) ? (
                <SelectGroup key={idx}>
                  <SelectLabel className='capitalize'>
                    {item.groupLabel}
                  </SelectLabel>
                  {item.options.map((opt, optIdx) => (
                    <SelectItem
                      // Position-qualified: option values are supplied by
                      // callers and are not guaranteed unique (Paystack's bank
                      // list, for one, repeats a CBN code across renamed
                      // branches). A bare value key makes React drop the
                      // duplicates silently.
                      key={`${opt.value}-${optIdx}`}
                      value={opt.value}
                      disabled={opt.disabled}
                      className='capitalize'
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : (
                <SelectItem
                  key={`${item.value}-${idx}`}
                  value={item.value}
                  disabled={item.disabled}
                  className='capitalize'
                >
                  {item.label}
                </SelectItem>
              ),
            )}
            {visible.length === 0 && (
              <p className='text-grey-400 py-3 text-center text-sm'>
                No results found
              </p>
            )}
          </SelectContent>
        </Select>
        {!required && !!field.value && !disabled && !loading && (
          <button
            type='button'
            onClick={handleClear}
            className='text-grey-400 hover:text-grey-600 absolute top-1/2 right-8 -translate-y-1/2 cursor-pointer'
            aria-label='Clear selection'
          >
            <X className='h-3.5 w-3.5' />
          </button>
        )}
      </div>
    </FieldWrapper>
  );
}
