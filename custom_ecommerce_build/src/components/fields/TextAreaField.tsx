'use client';

import { useField } from 'formik';
import React from 'react';

import { FormTextarea, FormTextareaProps } from '@/components/ui/form-textarea';

import { FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

export interface TextAreaFieldProps extends Omit<
  FormTextareaProps,
  'name' | 'id' | 'value' | 'onChange' | 'onBlur'
> {
  name: string;
  label?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

export function TextAreaField({
  name,
  label,
  required,
  hint,
  success,
  fieldSize,
  wrapperClassName,
  ...textareaProps
}: TextAreaFieldProps) {
  const [field, meta, helpers] = useField<string>(name);

  const handleBlur = () => helpers.setTouched(true);
  const showError = !!(meta.touched && meta.error);

  return (
    <FieldWrapper
      name={name}
      label={label}
      required={required}
      hint={hint}
      success={success}
      error={meta.error}
      touched={meta.touched}
      className={wrapperClassName}
    >
      <FormTextarea
        id={name}
        {...textareaProps}
        name={name}
        value={field.value ?? ''}
        onChange={(e) => helpers.setValue(e.target.value)}
        onBlur={handleBlur}
        hasError={showError}
        fieldSize={fieldSize}
        aria-describedby={
          showError ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        aria-invalid={showError ? true : undefined}
      />
    </FieldWrapper>
  );
}
