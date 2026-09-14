'use client';

import { useField } from 'formik';
import {
  AsYouType,
  type CountryCode,
  getCountries,
  getCountryCallingCode,
} from 'libphonenumber-js';
import { ChevronDown, Search } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import {
  fieldContainerVariants,
  fieldInputVariants,
  type FieldSize,
} from '@/constant/cva';

import { FieldWrapper } from './FieldWrapper';

function toFlagEmoji(iso2: string): string {
  return Array.from(iso2.toUpperCase())
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join('');
}

interface CountryOption {
  code: CountryCode;
  dialCode: string;
  flag: string;
  name: string;
}

const DISPLAY_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

const COUNTRY_OPTIONS: CountryOption[] = getCountries()
  .map((code) => ({
    code,
    dialCode: `+${getCountryCallingCode(code)}`,
    flag: toFlagEmoji(code),
    name: DISPLAY_NAMES.of(code) ?? code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const DEFAULT_COUNTRY: CountryCode = 'NG';

export interface PhoneFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  hint?: string;
  success?: string;
  placeholder?: string;
  disabled?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  defaultCountry?: CountryCode;
}

export function PhoneField({
  name,
  label,
  required,
  hint,
  success,
  placeholder = 'Enter phone number',
  disabled,
  fieldSize = 'sm',
  wrapperClassName,
  defaultCountry = DEFAULT_COUNTRY,
}: PhoneFieldProps) {
  const [, meta, helpers] = useField<string>(name);

  const [selectedCountry, setSelectedCountry] =
    useState<CountryCode>(defaultCountry);
  const [inputValue, setInputValue] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  const showError = !!(meta.touched && meta.error);
  const state = showError ? 'error' : 'default';

  const selected = useMemo(
    () =>
      COUNTRY_OPTIONS.find((c) => c.code === selectedCountry) ??
      COUNTRY_OPTIONS.find((c) => c.code === DEFAULT_COUNTRY) ??
      COUNTRY_OPTIONS[0],
    [selectedCountry],
  );

  const filtered = useMemo(() => {
    if (!search) return COUNTRY_OPTIONS;
    const q = search.toLowerCase();
    return COUNTRY_OPTIONS.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dialCode.includes(q) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleCountrySelect = (country: CountryOption) => {
    setSelectedCountry(country.code);
    setDropdownOpen(false);
    setSearch('');
    if (inputValue) {
      const formatter = new AsYouType(country.code);
      const formatted = formatter.input(inputValue.replace(/\D/g, ''));
      setInputValue(formatted);
      const number = formatter.getNumberValue();
      helpers.setValue(number ?? inputValue);
    }
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatter = new AsYouType(selectedCountry);
    const formatted = formatter.input(raw);
    setInputValue(formatted);
    const number = formatter.getNumberValue();
    helpers.setValue(number ?? raw);
  };

  const handleBlur = () => helpers.setTouched(true);

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
      <div
        className={cn(
          fieldContainerVariants({ fieldSize, state }),
          disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
          'relative gap-0 overflow-visible p-0',
        )}
      >
        {/* Country selector trigger */}
        <button
          type='button'
          disabled={disabled}
          onClick={() => setDropdownOpen((o) => !o)}
          className={cn(
            'border-grey-50 flex h-full shrink-0 items-center gap-1 border-r px-2.5',
            'text-grey-700 hover:bg-grey-50/50 rounded-l-xs text-sm transition-colors',
            'focus-visible:ring-primary/40 focus:outline-none focus-visible:ring-1',
            disabled && 'pointer-events-none',
          )}
          aria-label='Select country code'
          aria-expanded={dropdownOpen}
          aria-haspopup='listbox'
        >
          <span className='text-base leading-none'>{selected.flag}</span>
          <span className='text-grey-500 text-xs'>{selected.dialCode}</span>
          <ChevronDown
            className={cn(
              'text-grey-400 h-3 w-3 transition-transform',
              dropdownOpen && 'rotate-180',
            )}
          />
        </button>

        {/* Phone number input */}
        <input
          ref={inputRef}
          id={name}
          type='tel'
          inputMode='tel'
          disabled={disabled}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleBlur}
          aria-describedby={
            showError ? `${name}-error` : hint ? `${name}-hint` : undefined
          }
          aria-invalid={showError ? true : undefined}
          className={cn(fieldInputVariants({ fieldSize }), 'px-3')}
        />

        {/* Country dropdown */}
        {dropdownOpen && (
          <>
            <div
              className='fixed inset-0 z-10'
              onClick={() => {
                setDropdownOpen(false);
                setSearch('');
              }}
            />
            <div
              role='listbox'
              aria-label='Select country'
              className={cn(
                'absolute top-full left-0 z-20 mt-1',
                'max-h-64 w-72 overflow-hidden',
                'border-grey-100 rounded-md border bg-white shadow-lg',
                'flex flex-col',
              )}
            >
              <div className='border-grey-50 flex items-center gap-2 border-b px-3 py-2'>
                <Search className='text-grey-400 h-3.5 w-3.5 shrink-0' />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder='Search country...'
                  className='placeholder:text-grey-400 flex-1 bg-transparent text-sm outline-none'
                />
              </div>
              <div className='flex-1 overflow-y-auto'>
                {filtered.length === 0 ? (
                  <p className='text-grey-400 px-4 py-3 text-sm'>
                    No results found
                  </p>
                ) : (
                  filtered.map((country) => (
                    <button
                      key={country.code}
                      type='button'
                      role='option'
                      aria-selected={country.code === selectedCountry}
                      onClick={() => handleCountrySelect(country)}
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2 text-sm',
                        'hover:bg-grey-50 text-left transition-colors',
                        country.code === selectedCountry &&
                          'bg-primary-50 text-primary font-medium',
                      )}
                    >
                      <span className='text-base'>{country.flag}</span>
                      <span className='flex-1 truncate'>{country.name}</span>
                      <span className='text-grey-400 text-xs'>
                        {country.dialCode}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </FieldWrapper>
  );
}
