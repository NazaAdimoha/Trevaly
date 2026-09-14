'use client';

import { useField } from 'formik';
import React from 'react';

import { cn } from '@/lib/utils';

import { FieldWrapper } from './FieldWrapper';

export interface RadioOption {
  label: string;
  value: string | boolean;
  disabled?: boolean;
}

export interface RadioGroupFieldProps {
  name: string;
  options: RadioOption[];
  label?: string;
  subtitle?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  wrapperClassName?: string;
}

export function RadioGroupField({
  name,
  options,
  label,
  subtitle,
  required,
  hint,
  success,
  wrapperClassName,
}: RadioGroupFieldProps) {
  const [field, meta, helpers] = useField<string | boolean>(name);

  const showError = !!(meta.touched && meta.error);

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
      <div
        className={cn(
          'flex w-full overflow-hidden rounded-xs border',
          options.length === 3 && '[&>label]:basis-1/3',
          showError ? 'border-error-200' : 'border-grey-50',
        )}
      >
        {options.map((option, index) => (
          <label
            key={String(option.value)}
            className={cn(
              'text-grey-700 hover:bg-grey-05 flex flex-1 cursor-pointer items-center gap-2.5 px-4 py-3 text-sm transition-colors',
              index !== options.length - 1 && 'border-grey-50 border-r',
              field.value === option.value && 'bg-grey-05',
              option.disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <input
              type='radio'
              name={name}
              value={String(option.value)}
              checked={field.value === option.value}
              disabled={option.disabled}
              onChange={() => {
                if (option.disabled) return;
                helpers.setValue(option.value);
                helpers.setTouched(true, false);
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
