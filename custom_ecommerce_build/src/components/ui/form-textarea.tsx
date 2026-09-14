'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  fieldContainerVariants,
  fieldInputVariants,
  FieldSize,
} from '@/constant/cva';

export interface FormTextareaProps extends Omit<
  React.ComponentProps<'textarea'>,
  'size'
> {
  hasError?: boolean;
  hasSuccess?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
  rows?: number;
}

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      className,
      hasError,
      hasSuccess,
      fieldSize = 'sm',
      wrapperClassName,
      disabled,
      rows = 4,
      ...props
    },
    ref,
  ) => {
    const state = hasError ? 'error' : hasSuccess ? 'success' : 'default';

    return (
      <div
        className={cn(
          fieldContainerVariants({ fieldSize, state }),
          '!h-auto items-start',
          disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
          wrapperClassName,
        )}
      >
        <textarea
          ref={ref}
          disabled={disabled}
          rows={rows}
          className={cn(
            fieldInputVariants({ fieldSize }),
            'resize-none py-0',
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
FormTextarea.displayName = 'FormTextarea';

export { FormTextarea };
