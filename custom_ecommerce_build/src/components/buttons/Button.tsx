'use client';

import { type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { ImSpinner2 } from 'react-icons/im';

import { cn } from '@/lib/utils';

import { buttonVariants } from '@/constant/cva';

type ButtonProps = {
  isLoading?: boolean;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  fullWidth?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  classNames?: {
    leftIcon?: string;
    rightIcon?: string;
  };
  isDarkBg?: boolean;
} & React.ComponentPropsWithRef<'button'>;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled: buttonDisabled,
      isLoading = false,
      variant = 'primary',
      size = 'm',
      fullWidth = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      classNames,
      ...rest
    },
    ref,
  ) => {
    const disabled = isLoading || buttonDisabled;

    return (
      <button
        ref={ref}
        type='button'
        disabled={disabled}
        className={cn(
          buttonVariants({ variant, size, isLoading, fullWidth }),
          className,
        )}
        {...rest}
      >
        {/* Loading Spinner */}
        {isLoading && (
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
            <ImSpinner2
              className={cn(
                'animate-spin text-base',
                variant === 'default' || variant === 'secondary'
                  ? 'text-gray-700'
                  : 'text-white',
              )}
            />
          </div>
        )}

        {/* Left Icon */}
        {LeftIcon && !isLoading && (
          <div className={cn('mr-2', classNames?.leftIcon)}>
            <LeftIcon size='1em' />
          </div>
        )}

        {/* Button Content */}
        <span className={cn(isLoading && 'opacity-0')}>{children}</span>

        {/* Right Icon */}
        {RightIcon && !isLoading && (
          <div className={cn('ml-2', classNames?.rightIcon)}>
            <RightIcon size='1em' />
          </div>
        )}
      </button>
    );
  },
);

Button.displayName = 'Button';

export default Button;
