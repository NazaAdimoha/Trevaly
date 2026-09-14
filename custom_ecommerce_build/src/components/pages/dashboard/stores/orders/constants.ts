import { OrderStatus } from '@/generated/prisma/enums';

/**
 * Status presentation, shared by the list and the detail page.
 *
 * Wording matches the merchant app and `ORDER_ACTION_LABEL` in core. A status
 * that reads "Paid" on the phone and "Confirmed" in the browser is two products,
 * and the merchant is the one left explaining the difference to a customer.
 */
export const ORDER_STATUS_BADGE: Record<
  OrderStatus,
  { label: string; className: string }
> = {
  [OrderStatus.PENDING]: {
    label: 'Pending',
    className: 'bg-amber-50 text-amber-700',
  },
  [OrderStatus.PAID]: { label: 'Paid', className: 'bg-green-50 text-green-700' },
  [OrderStatus.SHIPPED]: {
    label: 'Shipped',
    className: 'bg-blue-50 text-blue-700',
  },
  [OrderStatus.DELIVERED]: {
    label: 'Delivered',
    className: 'bg-emerald-50 text-emerald-800',
  },
  [OrderStatus.CANCELLED]: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600',
  },
  [OrderStatus.REFUNDED]: {
    label: 'Refunded',
    className: 'bg-purple-50 text-purple-700',
  },
};

export const ORDER_STATUS_OPTIONS = [
  { label: 'All statuses', value: '__all__' },
  ...Object.entries(ORDER_STATUS_BADGE).map(([value, { label }]) => ({
    label,
    value,
  })),
];
