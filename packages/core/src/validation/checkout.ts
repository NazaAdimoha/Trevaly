import { z } from "zod";

import { DeliveryMethod } from "../enums";

/**
 * Checkout input contract.
 *
 * The quantity bounds are load-bearing, not cosmetic. Without `.int().min(1)` a
 * cart can carry a negative quantity, which subtracts from the subtotal and
 * lets an attacker drive a real order to ~zero — every downstream total is
 * computed server-side and would agree.
 */

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  /**
   * Present only for a product that sells by variant. The route rejects a
   * mismatch in BOTH directions — a missing variant on a variant product, and a
   * supplied one on a product without variants. Silently ignoring the second
   * would let a client attach an arbitrary id to a line and hide a bug (or a
   * probe) behind a successful order.
   */
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99),
});

export const checkoutSchema = z
  .object({
    items: z.array(checkoutItemSchema).min(1).max(50),
    customerName: z.string().trim().min(2).max(120),
    customerEmail: z.email().max(200),
    customerPhone: z
      .string()
      .trim()
      .regex(/^(\+?234|0)[789]\d{9}$/, "Enter a valid Nigerian phone number"),
    deliveryMethod: z.enum(DeliveryMethod),
    deliveryZoneId: z.string().min(1).optional(),
    deliveryAddress: z.string().trim().min(5).max(500).optional(),
    couponCode: z.string().trim().min(1).max(40).optional(),
  })
  .refine(
    (v) =>
      v.deliveryMethod !== DeliveryMethod.ZONE_DELIVERY ||
      (Boolean(v.deliveryZoneId) && Boolean(v.deliveryAddress)),
    {
      message: "Delivery zone and address are required for delivery orders",
      path: ["deliveryZoneId"],
    },
  );

export type CheckoutPayload = z.infer<typeof checkoutSchema>;

/** The identity of a cart line. Two sizes of one dress are two lines. */
export function cartLineKey(item: {
  productId: string;
  variantId?: string | null;
}): string {
  return `${item.productId}::${item.variantId ?? ""}`;
}

/**
 * Collapse duplicate cart lines into one entry per product *and variant*.
 *
 * The original checkout compared `products.length !== productIds.length` to
 * detect unavailable items, which misfires whenever the same product appears on
 * two lines — a legitimate cart gets rejected as "unavailable".
 *
 * Merging on the product alone would be a worse bug now: a cart holding one
 * Small and one Large of the same dress would collapse to two of whichever
 * variant came first, and the customer would be charged for and sent the wrong
 * size. The key has to include the variant.
 */
export function mergeCartItems(
  items: ReadonlyArray<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>,
): Array<{ productId: string; variantId: string | null; quantity: number }> {
  const merged = new Map<
    string,
    { productId: string; variantId: string | null; quantity: number }
  >();

  for (const item of items) {
    const key = cartLineKey(item);
    const existing = merged.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      merged.set(key, {
        productId: item.productId,
        variantId: item.variantId ?? null,
        quantity: item.quantity,
      });
    }
  }

  return [...merged.values()];
}

export const couponPreviewSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotalKobo: z.number().int().min(0),
});
