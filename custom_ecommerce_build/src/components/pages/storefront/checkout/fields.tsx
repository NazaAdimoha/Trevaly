'use client';

import { useField } from 'formik';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Checkout's own form controls.
 *
 * Deliberately NOT `@/components/fields/*`. Those belong to the dashboard: they
 * carry currency masking, left slots, `cva` size variants and a hardcoded grey
 * palette, none of which a storefront wants. Restyling them would have dragged
 * the whole admin UI along, and reusing them as they are is what made checkout
 * the one page that did not look like the shop.
 *
 * These are thin — a label, a control on the store's tokens, and an error — and
 * they are the reason a merchant's accent, radius and typeface reach the only
 * page where a shopper types.
 */
function Wrapper({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className='st-display mb-2 block text-sm'>
        {label}
      </label>
      {children}
      {/* The hint is replaced by the error rather than sitting beside it, so a
          field never shows advice and a correction at the same time. */}
      {error ? (
        <p id={`${name}-error`} role='alert' className='mt-1.5 text-xs' style={{ color: 'var(--st-sale)' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className='st-muted mt-1.5 text-xs'>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Shared control chrome, so an input, a select and a textarea cannot drift. */
function controlStyle(invalid: boolean) {
  return {
    border: `1px solid ${invalid ? 'var(--st-sale)' : 'var(--st-line)'}`,
    background: 'var(--st-bg)',
    color: 'var(--st-ink)',
  };
}

const CONTROL = 'st-control w-full px-4 py-3 text-sm outline-none';

export function TextField({
  name,
  label,
  hint,
  type = 'text',
  placeholder,
  autoComplete,
  inputMode,
}: {
  name: string;
  label: string;
  hint?: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric';
}) {
  const [field, meta] = useField<string>(name);
  const invalid = Boolean(meta.touched && meta.error);

  return (
    <Wrapper name={name} label={label} hint={hint} error={invalid ? meta.error : undefined}>
      <input
        {...field}
        id={name}
        type={type}
        placeholder={placeholder}
        // `autoComplete` is the single highest-leverage attribute on this page:
        // it is what lets a phone fill four fields in one tap, and its absence
        // is measured in abandoned carts, not in style.
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={CONTROL}
        style={controlStyle(invalid)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : hint ? `${name}-hint` : undefined}
      />
    </Wrapper>
  );
}

export function AreaField({
  name,
  label,
  hint,
  rows = 3,
  placeholder,
  autoComplete,
}: {
  name: string;
  label: string;
  hint?: string;
  rows?: number;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [field, meta] = useField<string>(name);
  const invalid = Boolean(meta.touched && meta.error);

  return (
    <Wrapper name={name} label={label} hint={hint} error={invalid ? meta.error : undefined}>
      <textarea
        {...field}
        id={name}
        rows={rows}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={cn(CONTROL, 'resize-y')}
        style={controlStyle(invalid)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : hint ? `${name}-hint` : undefined}
      />
    </Wrapper>
  );
}

export function PickField({
  name,
  label,
  hint,
  placeholder,
  options,
}: {
  name: string;
  label: string;
  hint?: string;
  placeholder?: string;
  options: { label: string; value: string }[];
}) {
  const [field, meta] = useField<string>(name);
  const invalid = Boolean(meta.touched && meta.error);

  return (
    <Wrapper name={name} label={label} hint={hint} error={invalid ? meta.error : undefined}>
      {/* A native <select>. On a phone that is the OS picker — bigger targets,
          familiar gestures, and it works with one hand — which no custom
          dropdown on this page would beat. */}
      <select
        {...field}
        id={name}
        className={cn(CONTROL, 'appearance-none')}
        style={{
          ...controlStyle(invalid),
          // The chevron, drawn rather than fetched, since `appearance-none`
          // removes the platform one.
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8' fill='none'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")",
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 1rem center',
          paddingRight: '2.5rem',
        }}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : hint ? `${name}-hint` : undefined}
      >
        {placeholder ? <option value=''>{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

/**
 * Delivery method as cards rather than a dropdown.
 *
 * Two options, and the choice changes the rest of the form and the total — that
 * is exactly the case where a `<select>` is wrong: it hides one option behind a
 * tap and gives no room to say what each costs. Radios keep both visible, and
 * the whole card is the label, so the target is the card.
 */
export function ChoiceField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: { label: string; value: string; note?: string }[];
}) {
  const [field, , helpers] = useField<string>(name);

  return (
    <fieldset>
      <legend className='st-display mb-2 text-sm'>{label}</legend>
      <div className='grid gap-3 sm:grid-cols-2'>
        {options.map((option) => {
          const active = field.value === option.value;
          return (
            <label
              key={option.value}
              className='st-control flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors'
              style={{
                border: `1px solid ${active ? 'var(--st-ink)' : 'var(--st-line)'}`,
                background: active ? 'var(--st-surface)' : 'transparent',
              }}
            >
              <input
                type='radio'
                name={name}
                value={option.value}
                checked={active}
                onChange={() => helpers.setValue(option.value)}
                className='mt-0.5 size-4 shrink-0 accent-[var(--st-ink)]'
              />
              <span className='min-w-0'>
                <span className='block text-sm font-medium'>{option.label}</span>
                {option.note ? (
                  <span className='st-muted block text-xs'>{option.note}</span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
