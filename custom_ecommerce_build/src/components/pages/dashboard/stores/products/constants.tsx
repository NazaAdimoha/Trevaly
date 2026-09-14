import type { SelectOption } from '@/components/fields/SelectField';

/** UI-only option sets. Domain enums live in the Prisma schema, never here. */

export const PRODUCT_STATUS_OPTIONS: SelectOption[] = [
  { label: 'Active', value: 'true' },
  { label: 'Inactive', value: 'false' },
];

export const STATUS_BADGE: Record<
  'active' | 'inactive',
  { label: string; className: string }
> = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800' },
  inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700' },
};

/** Low-stock threshold used for the amber warning in the products table. */
export const LOW_STOCK_THRESHOLD = 5;
