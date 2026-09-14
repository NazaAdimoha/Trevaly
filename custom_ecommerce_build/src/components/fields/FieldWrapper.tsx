'use client';

import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import React, { useState } from 'react';

import { cn } from '@/lib/utils';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface FieldWrapperProps {
  name: string;
  label?: string;
  subtitle?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  success?: string;
  touched?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FieldWrapper({
  name,
  label,
  subtitle,
  required,
  hint,
  error,
  success,
  touched,
  className,
  children,
}: FieldWrapperProps) {
  const [open, setOpen] = useState(false);

  const showError = !!(touched && error);
  const showSuccess = !showError && !!success;
  const showHint = !showError && !showSuccess && !!hint;
  const hasMessage = showError || showSuccess || showHint;

  const message = showError ? error : showSuccess ? success : hint;

  const icon = showError ? (
    <AlertCircle className='text-error-500 h-3.5 w-3.5' />
  ) : showSuccess ? (
    <CheckCircle2 className='text-success-600 h-3.5 w-3.5' />
  ) : (
    <Info className='text-grey-400 h-3.5 w-3.5' />
  );

  const messageColor = showError
    ? 'text-error-500'
    : showSuccess
      ? 'text-success-600'
      : 'text-grey-600';

  const indicator = hasMessage && (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type='button'
          aria-label={message}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className='flex items-center focus:outline-none'
        >
          {icon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side='top'
        align='start'
        sideOffset={6}
        className='border-error-500 w-auto max-w-xs rounded-md border bg-white px-3 py-2 shadow-lg'
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <p className={cn('text-xs', messageColor)}>{message}</p>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <div className='flex items-center gap-1'>
          <label htmlFor={name} className='text-grey-700 text-sm font-medium'>
            {label}
            {required && (
              <span className='text-error-600 ml-0.5' aria-hidden='true'>
                *
              </span>
            )}
          </label>
          {indicator}
        </div>
      ) : (
        hasMessage && <div className='flex justify-end'>{indicator}</div>
      )}

      {children}

      {subtitle ? <p className='text-grey-600 text-sm'>{subtitle}</p> : null}
    </div>
  );
}
