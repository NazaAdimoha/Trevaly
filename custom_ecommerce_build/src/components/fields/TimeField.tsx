'use client';

import { useField } from 'formik';
import React from 'react';

import { FormInput, FormInputProps } from '@/components/ui/form-input';

import { FieldSize } from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

/**
 * Normalize any recognizable time string to HH:mm:ss.
 * Handles: HH:mm:ss (passthrough), HH:mm (appends :00), hh:mm AM/PM (converts to 24-hour).
 * Returns '' for unrecognized or empty values.
 */
function normalizeToHHmmss(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (/^\d{2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;

  if (/^\d{2}:\d{2}$/.test(trimmed)) return `${trimmed}:00`;

  const amPmMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)$/i.exec(trimmed);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2];
    const seconds = amPmMatch[3] ?? '00';
    const period = amPmMatch[4].toLowerCase();

    if (period === 'am') {
      if (hours === 12) hours = 0;
    } else {
      if (hours !== 12) hours += 12;
    }

    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  }

  return '';
}

export interface TimeFieldProps extends Omit<
  FormInputProps,
  'name' | 'id' | 'value' | 'onChange' | 'onBlur' | 'type'
> {
  name: string;
  label?: string;
  subtitle?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

export function TimeField({
  name,
  label,
  subtitle,
  required,
  hint,
  success,
  fieldSize,
  wrapperClassName,
  ...inputProps
}: TimeFieldProps) {
  const [field, meta, helpers] = useField<string>(name);

  const showError = !!(meta.touched && meta.error);

  // Normalize the stored value to a format the native time input accepts (HH:mm:ss).
  // Fall back to the raw value so legacy drafts remain visible and correctable.
  const displayValue = normalizeToHHmmss(field.value) || field.value || '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Native time input emits HH:mm (step default) or HH:mm:ss (step=1).
    helpers.setValue(normalizeToHHmmss(raw) || raw);
  };

  const handleBlur = () => helpers.setTouched(true);

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
        type='time'
        step={1}
        value={displayValue}
        onChange={handleChange}
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
