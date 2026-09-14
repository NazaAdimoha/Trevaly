import { OrderStatus } from './enums';

/**
 * Which status an order may move to, from where.
 *
 * Shared, and that is the point: the server enforces it, the web dashboard
 * renders buttons from it, and the mobile app does too. Duplicating this table
 * would mean an app offering "Mark shipped" on an order the API will refuse —
 * the merchant taps, nothing happens, and nobody can explain why.
 *
 * The shape encodes real rules: money that has moved cannot be un-moved, so a
 * PAID order can be shipped, cancelled or refunded but never returned to
 * PENDING; and CANCELLED and REFUNDED are terminal.
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUNDED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return ALLOWED_ORDER_TRANSITIONS[status] ?? [];
}

/** What a merchant should see on the button, rather than the enum name. */
export const ORDER_ACTION_LABEL: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Mark pending',
  [OrderStatus.PAID]: 'Mark paid',
  [OrderStatus.SHIPPED]: 'Mark shipped',
  [OrderStatus.DELIVERED]: 'Mark delivered',
  [OrderStatus.CANCELLED]: 'Cancel order',
  [OrderStatus.REFUNDED]: 'Mark refunded',
};
