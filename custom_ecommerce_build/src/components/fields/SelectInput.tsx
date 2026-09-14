import { Loader2 } from 'lucide-react';
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
import type { SelectOptionOrGroup } from './SelectField';

export type {
  SelectOption,
  SelectOptionGroup,
  SelectOptionOrGroup,
} from './SelectField';

function isGroup(
  item: SelectOptionOrGroup,
): item is Extract<SelectOptionOrGroup, { groupLabel: string }> {
  return 'groupLabel' in item;
}

export interface SelectInputProps {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOptionOrGroup[];
  label?: string;
  subtitle?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  disabled?: boolean;
  loading?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  className?: string;
}

export function SelectInput({
  id,
  value,
  onValueChange,
  options,
  label,
  subtitle,
  placeholder = 'Select an option',
  required,
  hint,
  disabled,
  loading,
  fieldSize = 'sm',
  wrapperClassName,
  className,
}: SelectInputProps) {
  return (
    <FieldWrapper
      name={id}
      label={label}
      subtitle={subtitle}
      required={required}
      hint={hint}
      className={wrapperClassName}
    >
      <Select
        key={loading ? 'loading' : 'loaded'}
        value={value ?? ''}
        onValueChange={onValueChange}
        disabled={disabled || loading}
      >
        <SelectTrigger
          id={id}
          className={cn(
            fieldContainerVariants({ fieldSize, state: 'default' }),
            'w-full',
            (disabled || loading) && 'bg-grey-50 cursor-not-allowed opacity-75',
            !value && 'text-grey-400',
            className,
          )}
        >
          {loading ? (
            <div className='text-grey-400 flex items-center gap-2'>
              <Loader2 className='h-4 w-4 animate-spin' />
              <span>Loading...</span>
            </div>
          ) : (
            <SelectValue placeholder={placeholder} />
          )}
        </SelectTrigger>

        <SelectContent className='max-h-60 bg-white'>
          {options.map((item, idx) =>
            isGroup(item) ? (
              <SelectGroup key={idx}>
                <SelectLabel className='capitalize'>
                  {item.groupLabel}
                </SelectLabel>
                {item.options.map((opt) => (
                  <SelectItem
                    key={opt.value}
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
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className='capitalize'
              >
                {item.label}
              </SelectItem>
            ),
          )}
          {options.length === 0 && (
            <p className='text-grey-400 py-3 text-center text-sm'>
              No options available
            </p>
          )}
        </SelectContent>
      </Select>
    </FieldWrapper>
  );
}
