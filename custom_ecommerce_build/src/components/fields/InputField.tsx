'use client';

import { useField } from 'formik';
import React from 'react';

import { FormInput, FormInputProps } from '@/components/ui/form-input';

import { FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

function formatCurrency(raw: string): string {
  const stripped = raw.replace(/[^0-9.]/g, '');
  const [intPart = '', decPart] = stripped.split('.');
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decPart !== undefined) return `${withCommas}.${decPart.slice(0, 2)}`;
  return withCommas;
}

function stripCurrencyFormat(formatted: string): string {
  return formatted.replace(/,/g, '');
}

function sanitizeDecimalInput(raw: string): string {
  const digitsAndDotsOnly = raw.replace(/[^0-9.]/g, '');
  const firstDotIndex = digitsAndDotsOnly.indexOf('.');

  if (firstDotIndex === -1) return digitsAndDotsOnly;

  const integerPart = digitsAndDotsOnly.slice(0, firstDotIndex + 1);
  const fractionalPart = digitsAndDotsOnly
    .slice(firstDotIndex + 1)
    .replace(/\./g, '');

  return `${integerPart}${fractionalPart}`;
}

export interface InputFieldProps extends Omit<
  FormInputProps,
  'name' | 'id' | 'value' | 'onChange' | 'onBlur'
> {
  name: string;
  label?: string;
  subtitle?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  format?: 'currency' | 'alphanumeric' | 'decimal' | 'none';
  /* ISO Value not currency ID */
  currency?: string | null;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

export function InputField({
  name,
  label,
  subtitle,
  required,
  hint,
  success,
  format = 'none',
  currency = '$',
  fieldSize,
  wrapperClassName,
  leftSlot,
  ...inputProps
}: InputFieldProps) {
  const [field, meta, helpers] = useField<string>(name);

  const isCurrency = format === 'currency';

  const displayValue = isCurrency
    ? formatCurrency(String(field.value ?? ''))
    : (field.value ?? '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCurrency) {
      const raw = stripCurrencyFormat(e.target.value);
      if (raw !== '' && isNaN(Number(raw))) return;
      helpers.setValue(raw);
    } else if (format === 'alphanumeric') {
      helpers.setValue(e.target.value.replace(/[^a-zA-Z0-9]/g, ''));
    } else if (format === 'decimal') {
      helpers.setValue(sanitizeDecimalInput(e.target.value));
    } else {
      helpers.setValue(e.target.value);
    }
  };

  const handleBlur = () => helpers.setTouched(true);

  const showError = !!(meta.touched && meta.error);

  const resolvedLeftSlot =
    leftSlot !== undefined
      ? leftSlot
      : isCurrency && currency !== null
        ? currency
        : undefined;

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
      <FormInput
        id={name}
        {...inputProps}
        name={name}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        hasError={showError}
        fieldSize={fieldSize}
        leftSlot={resolvedLeftSlot}
        aria-describedby={
          showError ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
        aria-invalid={showError ? true : undefined}
      />
    </FieldWrapper>
  );
}
