'use client';

import React from 'react';

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

export interface FilterSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface FilterSelectOptionGroup {
  groupLabel: string;
  options: FilterSelectOption[];
}

export type FilterSelectOptionOrGroup =
  FilterSelectOption | FilterSelectOptionGroup;

function isGroup(
  item: FilterSelectOptionOrGroup,
): item is FilterSelectOptionGroup {
  return 'groupLabel' in item;
}

export interface FilterSelectProps {
  id: string;
  options: FilterSelectOptionOrGroup[];
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  disabled?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  className?: string;
}

export function FilterSelect({
  id,
  options,
  value,
  onValueChange,
  label,
  placeholder = 'Select an option',
  required,
  hint,
  error,
  disabled,
  fieldSize = 'sm',
  wrapperClassName,
  className,
}: FilterSelectProps) {
  const showError = !!error;
  const state = showError ? 'error' : 'default';

  return (
    <FieldWrapper
      name={id}
      label={label}
      required={required}
      hint={hint}
      error={error}
      touched={showError}
      className={wrapperClassName}
    >
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn(
            fieldContainerVariants({ fieldSize, state }),
            'w-full',
            disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
            !value && 'text-grey-400',
            className,
          )}
          aria-describedby={
            showError ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
          aria-invalid={showError ? true : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>

        <SelectContent className='bg-white'>
          {options.map((item, idx) =>
            isGroup(item) ? (
              <SelectGroup key={idx}>
                <SelectLabel>{item.groupLabel}</SelectLabel>
                {item.options.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    disabled={opt.disabled}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ) : (
              <SelectItem
                key={item.value}
                value={item.value}
                disabled={item.disabled}
              >
                {item.label}
              </SelectItem>
            ),
          )}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}
