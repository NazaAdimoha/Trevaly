'use client';

import { type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { IconType } from 'react-icons';
import { ImSpinner2 } from 'react-icons/im';

import { cn } from '@/lib/utils';

import { iconButtonVariants } from '@/constant/cva';

type IconButtonProps = {
  isLoading?: boolean;
  variant?: VariantProps<typeof iconButtonVariants>['variant'];
  size?: VariantProps<typeof iconButtonVariants>['size'];
  icon?: IconType | LucideIcon;
  classNames?: {
    icon?: string;
  };
} & React.ComponentPropsWithRef<'button'>;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      disabled: buttonDisabled,
      isLoading = false,
      variant = 'primary',
      size = 'm',
      icon: Icon,
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
          iconButtonVariants({ variant, size, isLoading }),
          className,
        )}
        {...rest}
      >
        {isLoading && (
          <div className='absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'>
            <ImSpinner2
              className={cn(
                'animate-spin',
                variant === 'default' || variant === 'secondary'
                  ? 'text-grey-700'
                  : 'text-white',
              )}
            />
          </div>
        )}
        {Icon && <Icon size='1em' className={cn(classNames?.icon)} />}
      </button>
    );
  },
);

IconButton.displayName = 'IconButton';

export default IconButton;
