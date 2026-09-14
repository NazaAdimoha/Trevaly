import { z } from "zod";

import { CouponType } from "../enums";

/**
 * Coupon write contract.
 *
 * `value` means different things per `type`, so the bounds have to be checked
 * together: a PERCENTAGE of 500 is nonsense, a FIXED of 500 kobo is ₦5.
 */
export const couponWriteSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]+$/, "Letters, numbers, hyphens and underscores only")
      .min(3)
      .max(40),
    type: z.enum(CouponType),
    value: z.number().int().min(1),
    minOrderKobo: z.number().int().min(0).default(0),
    maxUses: z.number().int().min(1).max(1_000_000).nullable().default(null),
    expiresAt: z.iso.datetime().nullable().default(null),
    isActive: z.boolean().default(true),
  })
  .refine((v) => v.type !== CouponType.PERCENTAGE || v.value <= 100, {
    message: "A percentage discount cannot exceed 100",
    path: ["value"],
  })
  .refine((v) => !v.expiresAt || new Date(v.expiresAt) > new Date(), {
    message: "Expiry must be in the future",
    path: ["expiresAt"],
  });

export const couponUpdateSchema = z.object({
  isActive: z.boolean().optional(),
  maxUses: z.number().int().min(1).max(1_000_000).nullable().optional(),
  expiresAt: z.iso.datetime().nullable().optional(),
});

export type CouponWritePayload = z.infer<typeof couponWriteSchema>;

/**
 * Discount for a given subtotal, in kobo.
 *
 * Shared by the checkout route and the coupon preview endpoint so the number a
 * customer is shown is computed by the same code that will charge them. The
 * clamp matters: a ₦5,000 fixed coupon on a ₦2,000 cart must not produce a
 * negative total.
 */
export function computeDiscountKobo(
  coupon: { type: CouponType; value: number },
  subtotalKobo: number,
): number {
  const raw =
    coupon.type === CouponType.PERCENTAGE
      ? Math.round((subtotalKobo * coupon.value) / 100)
      : coupon.value;

  return Math.min(raw, subtotalKobo);
}

/** Every reason a coupon may be refused, evaluated server-side only. */
export function couponRejectionReason(
  coupon: {
    isActive: boolean;
    expiresAt: Date | null;
    maxUses: number | null;
    timesUsed: number;
    minOrderKobo: number | null;
  } | null,
  subtotalKobo: number,
): string | null {
  if (!coupon) return "Coupon not found";
  if (!coupon.isActive) return "This coupon is no longer active";
  if (coupon.expiresAt && coupon.expiresAt <= new Date())
    return "This coupon has expired";
  if (coupon.maxUses !== null && coupon.timesUsed >= coupon.maxUses) {
    return "This coupon has been fully used";
  }
  if (subtotalKobo < (coupon.minOrderKobo ?? 0)) {
    return "Your order is below this coupon’s minimum";
  }
  return null;
}
