'use client';

import React from 'react';

import { FormInput, FormInputProps } from '@/components/ui/form-input';

import { FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

export interface SearchInputProps extends Omit<
  FormInputProps,
  'id' | 'hasError' | 'hasSuccess'
> {
  id: string;
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

export function SearchInput({
  id,
  label,
  required,
  hint,
  error,
  fieldSize,
  wrapperClassName,
  ...inputProps
}: SearchInputProps) {
  const showError = !!error;

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
      <FormInput
        id={id}
        hasError={showError}
        fieldSize={fieldSize}
        {...inputProps}
      />
    </FieldWrapper>
  );
}
