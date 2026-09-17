'use client';

import { useField } from 'formik';

import { cn } from '@/lib/utils';

import {
  STOREFRONT_THEME_OPTIONS,
  STOREFRONT_THEMES,
} from '@/constant/storefront-themes';
import type { StorefrontTheme } from '@core/enums';

/**
 * Storefront look picker.
 *
 * A purpose-built field rather than `RadioGroupField`, because the operator is
 * choosing on a merchant's behalf after a phone call and needs to see what each
 * one does — a list of three words does not carry that. The thumbnails are
 * drawn from `STOREFRONT_THEMES` itself, so they show the real column count and
 * image shape and cannot drift from the storefront they describe.
 */
export default function ThemeField({ name = 'theme' }: { name?: string }) {
  const [field, meta, helpers] = useField<StorefrontTheme>(name);
  const showError = Boolean(meta.touched && meta.error);

  return (
    <fieldset className='rounded-lg border p-4'>
      <legend className='px-1 text-sm font-medium'>Storefront look</legend>
      <p className='mt-1 text-xs text-gray-600'>
        Changeable later. Pick for the catalogue, not the logo — the image shape
        is what matters most.
      </p>

      <div className='mt-4 grid gap-3 sm:grid-cols-3'>
        {STOREFRONT_THEME_OPTIONS.map((option) => {
          const selected = field.value === option.value;

          return (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer flex-col rounded-lg border p-3 transition-colors',
                selected
                  ? 'border-primary bg-primary-50/60 ring-primary/30 ring-2'
                  : 'border-grey-100 hover:border-grey-200',
              )}
            >
              <input
                type='radio'
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => helpers.setValue(option.value)}
                onBlur={() => helpers.setTouched(true)}
                className='sr-only'
              />
              <ThemeThumbnail theme={option.value} />
              <span className='mt-2.5 text-sm font-medium'>{option.label}</span>
              <span className='mt-1 text-xs leading-relaxed text-gray-600'>
                {option.description}
              </span>
              <span className='text-grey-500 mt-2 text-[11px] leading-snug'>
                {option.suitedTo}
              </span>
            </label>
          );
        })}
      </div>

      {showError ? (
        <p role='alert' className='text-error mt-2 text-xs'>
          {meta.error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** A miniature of the real grid: same columns, same aspect ratio, same radius. */
function ThemeThumbnail({ theme }: { theme: StorefrontTheme }) {
  const { vars } = STOREFRONT_THEMES[theme];
  const columns = Number(vars['--st-cols-md'] ?? 3);
  const tiles = columns * 2;

  return (
    <span
      aria-hidden='true'
      className='grid rounded bg-gray-50 p-2'
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: `calc(${vars['--st-grid-gap'] ?? '1rem'} / 4)`,
      }}
    >
      {Array.from({ length: tiles }, (_, index) => (
        <span
          key={index}
          className='block bg-gray-300'
          style={{
            aspectRatio: vars['--st-product-aspect'] ?? '1 / 1',
            borderRadius: `calc(${vars['--st-radius'] ?? '0px'} / 2)`,
          }}
        />
      ))}
    </span>
  );
}
