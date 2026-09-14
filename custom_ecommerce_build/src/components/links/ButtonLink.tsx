'use client';

import { type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { IconType } from 'react-icons';

import { cn } from '@/lib/utils';

import UnstyledLink, {
  UnstyledLinkProps,
} from '@/components/links/UnstyledLink';

import { buttonLinkVariants } from '@/constant/cva';

type ButtonLinkProps = {
  variant?: VariantProps<typeof buttonLinkVariants>['variant'];
  size?: VariantProps<typeof buttonLinkVariants>['size'];
  leftIcon?: IconType | LucideIcon;
  rightIcon?: IconType | LucideIcon;
  classNames?: {
    leftIcon?: string;
    rightIcon?: string;
  };
  isDarkBg?: boolean;
  fullWidth?: boolean;
} & UnstyledLinkProps;

const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'm',
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      fullWidth = false,
      classNames,
      ...rest
    },
    ref,
  ) => {
    return (
      <UnstyledLink
        ref={ref}
        {...rest}
        className={cn(
          buttonLinkVariants({ variant, size, fullWidth }),
          className,
        )}
      >
        {LeftIcon && (
          <div className={cn('mr-2', classNames?.leftIcon)}>
            <LeftIcon size='1em' />
          </div>
        )}
        {children}
        {RightIcon && (
          <div className={cn('ml-2', classNames?.rightIcon)}>
            <RightIcon size='1em' />
          </div>
        )}
      </UnstyledLink>
    );
  },
);

ButtonLink.displayName = 'ButtonLink';

export default ButtonLink;
