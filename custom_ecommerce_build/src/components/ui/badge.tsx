import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit items-center rounded-xs px-2 py-1 md:text-xs xl:text-sm font-medium shadow border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: ' bg-badge-default text-white hover:bg-badge-default/80',
        information: ' bg-badge-info text-white hover:bg-badge-info/80',
        success: ' bg-badge-success text-white hover:bg-badge-success/80',
        error: ' bg-badge-error text-white hover:bg-badge-error/80',
        warning: ' bg-warning-500 text-dark-100 hover:bg-badge-warning/80',
        secondary:
          ' bg-badge-secondary text-secondary-400 hover:bg-badge-secondary/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
