'use client';

import React from 'react';

import { cn } from '@/lib/utils';

import { FieldWrapper } from './FieldWrapper';
import type { RadioOption } from './RadioGroupField';

export type { RadioOption } from './RadioGroupField';

export interface RadioGroupInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: RadioOption[];
  label?: string;
  subtitle?: string;
  required?: boolean;
  hint?: string;
  wrapperClassName?: string;
}

export function RadioGroupInput({
  id,
  value,
  onChange,
  options,
  label,
  subtitle,
  required,
  hint,
  wrapperClassName,
}: RadioGroupInputProps) {
  return (
    <FieldWrapper
      name={id}
      label={label}
      subtitle={subtitle}
      required={required}
      hint={hint}
      className={wrapperClassName}
    >
      <div
        className={cn(
          'border-grey-50 flex w-full overflow-hidden rounded-xs border',
          options.length === 3 && '[&>label]:basis-1/3',
        )}
      >
        {options.map((option, index) => (
          <label
            key={String(option.value)}
            className={cn(
              'text-grey-700 hover:bg-grey-05 flex flex-1 cursor-pointer items-center gap-2.5 px-4 py-3 text-sm transition-colors',
              index !== options.length - 1 && 'border-grey-50 border-r',
              value === String(option.value) && 'bg-grey-05',
              option.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <input
              type='radio'
              name={id}
              value={String(option.value)}
              checked={value === String(option.value)}
              disabled={option.disabled}
              onChange={() => {
                if (option.disabled) return;
                onChange(String(option.value));
              }}
              className='accent-primary h-4 w-4'
            />
            {option.label}
          </label>
        ))}
      </div>
    </FieldWrapper>
  );
}
