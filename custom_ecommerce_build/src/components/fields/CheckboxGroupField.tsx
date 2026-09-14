'use client';

import { useField } from 'formik';

import { cn } from '@/lib/utils';

import { Checkbox } from '@/components/ui/checkbox';

import { FieldWrapper } from './FieldWrapper';

export interface CheckboxGroupOption {
  label: string;
  value: string | number;
}

export interface CheckboxGroupFieldProps {
  name: string;
  label?: string;
  subtitle?: string;
  required?: boolean;
  options: CheckboxGroupOption[];
  columns?: 1 | 2 | 3 | 4;
  wrapperClassName?: string;
}

export function CheckboxGroupField({
  name,
  label,
  subtitle,
  required,
  options,
  columns = 3,
  wrapperClassName,
}: CheckboxGroupFieldProps) {
  const [field, meta, helpers] = useField<Array<string | number>>(name);

  const selectedValues = field.value ?? [];
  const hasError = Boolean(meta.touched && meta.error);

  const gridClass =
    columns === 1
      ? 'grid-cols-1'
      : columns === 2
        ? 'grid-cols-2'
        : columns === 4
          ? 'grid-cols-4'
          : 'grid-cols-3';

  return (
    <FieldWrapper
      name={name}
      label={label}
      subtitle={subtitle}
      required={required}
      error={meta.error}
      touched={meta.touched}
      className={wrapperClassName}
    >
      <div
        className={cn(
          'border-grey-50 grid gap-3 rounded-xs border p-3',
          gridClass,
          hasError && 'border-error-200',
        )}
      >
        {options.map((option) => {
          const checked = selectedValues.includes(option.value);

          return (
            <label
              key={String(option.value)}
              className='text-grey-700 flex cursor-pointer items-center gap-2 text-sm'
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(nextChecked) => {
                  const next =
                    nextChecked === true
                      ? [...selectedValues, option.value]
                      : selectedValues.filter((item) => item !== option.value);

                  helpers.setValue(next);
                  helpers.setTouched(true, false);
                }}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </FieldWrapper>
  );
}
