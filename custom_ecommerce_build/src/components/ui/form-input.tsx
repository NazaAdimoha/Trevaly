import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  fieldContainerVariants,
  fieldInputVariants,
  FieldSize,
} from '@/constant/cva';

export interface FormInputProps extends Omit<
  React.ComponentProps<'input'>,
  'size'
> {
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  hasError?: boolean;
  hasSuccess?: boolean;
  fieldSize?: FieldSize;
  wrapperClassName?: string;
}

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    {
      className,
      leftSlot,
      rightSlot,
      hasError,
      hasSuccess,
      fieldSize = 'sm',
      wrapperClassName,
      disabled,
      ...props
    },
    ref,
  ) => {
    const state = hasError ? 'error' : hasSuccess ? 'success' : 'default';

    return (
      <div
        className={cn(
          fieldContainerVariants({ fieldSize, state }),
          disabled && 'bg-grey-50 cursor-not-allowed opacity-75',
          wrapperClassName,
        )}
      >
        {leftSlot && (
          <span className='flex shrink-0 items-center px-0.5 text-sm'>
            {leftSlot}
          </span>
        )}

        <input
          ref={ref}
          disabled={disabled}
          className={cn(fieldInputVariants({ fieldSize }), className)}
          {...props}
        />

        {rightSlot && (
          <span className='text-grey-400 flex shrink-0 items-center px-0.5 text-sm'>
            {rightSlot}
          </span>
        )}
      </div>
    );
  },
);
FormInput.displayName = 'FormInput';

export { FormInput };
