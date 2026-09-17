import { z } from "zod";

import { OrderStatus } from "../enums";

/** Query string of the store's order list. */
export const orderListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: z.enum(OrderStatus).optional(),
  needsAttention: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * What a store may change on an order.
 *
 * The status is further restricted by `nextStatuses`. `PAID` is never reachable
 * by hand: an order becomes PAID only when the gateway confirms the money.
 */
export const orderUpdateSchema = z.object({
  status: z.enum(OrderStatus).optional(),
  internalNote: z.string().trim().max(2000).nullable().optional(),
  hasStockIssue: z.boolean().optional(),
  // `false` only. The flag is raised by the payment path when real money lands
  // on a cancelled order; a merchant resolves it, but setting it by hand would
  // assert a payment that never happened.
  paidAfterCancellation: z.literal(false).optional(),
});

export type OrderUpdatePayload = z.infer<typeof orderUpdateSchema>;
