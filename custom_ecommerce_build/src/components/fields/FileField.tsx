'use client';

import { useField } from 'formik';
import { CloudUpload, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { FieldWrapper } from './FieldWrapper';

export interface FileFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  hint?: string;
  accept?: string;
  maxSizeMB?: number;
  wrapperClassName?: string;
  className?: string;
  persistedFileName?: string;
  persistedFileId?: string;
  onFileSelect?: (file: File) => Promise<void> | void;
  onPersistedRemove?: (id: string) => Promise<void> | void;
}

const DEFAULT_ACCEPT =
  'application/pdf,image/png,image/jpg,image/jpeg,image/bmp';
const DEFAULT_MAX_MB = 20;

export function FileField({
  name,
  label,
  required,
  hint,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  wrapperClassName,
  className,
  persistedFileName,
  persistedFileId,
  onFileSelect,
  onPersistedRemove,
}: FileFieldProps) {
  const [field, meta, helpers] = useField<File | null>(name);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const showError = !!(meta.touched && meta.error);
  const hasPersistedFile = Boolean(!field.value && persistedFileName);

  const runFileSelect = async (file: File) => {
    helpers.setValue(file);
    helpers.setTouched(true, false);

    if (!onFileSelect) return;

    setIsProcessing(true);
    try {
      await onFileSelect(file);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to upload file. Please try again.';
      helpers.setError(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      helpers.setTouched(true, false);
      helpers.setError(`File must be smaller than ${maxSizeMB}MB`);
      return;
    }
    await runFileSelect(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      helpers.setTouched(true, false);
      helpers.setError(`File must be smaller than ${maxSizeMB}MB`);
      return;
    }
    await runFileSelect(file);
  };

  const handleRemove = async () => {
    if (persistedFileId && onPersistedRemove) {
      setIsProcessing(true);
      try {
        await onPersistedRemove(persistedFileId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Unable to remove file. Please try again.';
        helpers.setError(message);
        setIsProcessing(false);
        return;
      }
      setIsProcessing(false);
    }

    helpers.setValue(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const acceptedLabel = 'PDF, PNG, JPG, JPEG, or BMP';

  return (
    <FieldWrapper
      name={name}
      label={label}
      required={required}
      hint={hint}
      error={meta.error}
      touched={meta.touched}
      className={wrapperClassName}
    >
      <input
        ref={inputRef}
        id={name}
        type='file'
        accept={accept}
        className='sr-only'
        onChange={handleChange}
        disabled={isProcessing}
        aria-describedby={
          showError ? `${name}-error` : hint ? `${name}-hint` : undefined
        }
      />

      {field.value || hasPersistedFile ? (
        <div
          className={cn(
            'border-grey-200 flex items-center justify-between rounded-[2px] border px-4 py-3',
            showError && 'border-error-600',
          )}
        >
          <span className='text-grey-900 truncate text-sm font-medium'>
            {field.value?.name || persistedFileName}
          </span>
          <button
            type='button'
            onClick={handleRemove}
            className='text-grey-400 hover:text-error-600 ml-3 shrink-0'
            aria-label='Remove file'
            disabled={isProcessing}
          >
            <X className='h-4 w-4' />
          </button>
        </div>
      ) : (
        <div
          role='button'
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          className={cn(
            'border-grey-200 flex cursor-pointer flex-col items-center gap-2 rounded-[2px] border px-6 py-8 transition-colors',
            'hover:border-primary/50 hover:bg-primary-50/30',
            isProcessing && 'cursor-not-allowed opacity-70',
            showError && 'border-error-600',
            className,
          )}
        >
          <CloudUpload className='text-grey-400 h-8 w-8' />
          <p className='text-sm'>
            <span className='text-primary font-medium'>Click to upload</span>
            <span className='text-grey-500'> or drag and drop</span>
          </p>
          <p className='text-grey-400 text-xs'>
            {acceptedLabel} (max. {maxSizeMB}MB)
          </p>
        </div>
      )}
    </FieldWrapper>
  );
}
