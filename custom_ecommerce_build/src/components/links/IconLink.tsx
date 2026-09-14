'use client';

import { type VariantProps } from 'class-variance-authority';
import { LucideIcon } from 'lucide-react';
import * as React from 'react';
import { IconType } from 'react-icons';

import { cn } from '@/lib/utils';

import UnstyledLink, {
  UnstyledLinkProps,
} from '@/components/links/UnstyledLink';

import { iconLinkVariants } from '@/constant/cva';

type IconLinkProps = {
  variant?: VariantProps<typeof iconLinkVariants>['variant'];
  size?: VariantProps<typeof iconLinkVariants>['size'];
  icon?: IconType | LucideIcon;
  classNames?: {
    icon?: string;
  };
} & Omit<UnstyledLinkProps, 'children'>;

const IconLink = React.forwardRef<HTMLAnchorElement, IconLinkProps>(
  (
    {
      className,
      icon: Icon,
      variant = 'primary',
      size = 'm',
      classNames,
      ...rest
    },
    ref,
  ) => {
    return (
      <UnstyledLink
        ref={ref}
        type='button'
        className={cn(iconLinkVariants({ variant, size }), className)}
        {...rest}
      >
        {Icon && <Icon size='1em' className={cn(classNames?.icon)} />}
      </UnstyledLink>
    );
  },
);

IconLink.displayName = 'IconLink';

export default IconLink;
