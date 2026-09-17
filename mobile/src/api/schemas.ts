import { z } from 'zod';

import { OrderStatus } from '@core/enums';

/**
 * Response shapes for the endpoints that already existed before the app did.
 *
 * The newer endpoints declare their contracts in `@core/api/contracts`, shared
 * with the route handlers. These older list endpoints predate that, so their
 * shapes are described here and validated at runtime — which is what catches a
 * deployed server that has moved on from the installed build.
 *
 * Every object is loose about unknown keys on purpose: the API is additive-only,
 * and an older app must ignore fields it has never heard of rather than reject
 * the whole response.
 */

export const orderListItemSchema = z.looseObject({
  id: z.string(),
  orderNumber: z.number().int(),
  status: z.enum(OrderStatus),
  customerName: z.string(),
  totalKobo: z.number().int(),
  hasStockIssue: z.boolean(),
  // Nullish so a response cached before this field existed still parses.
  paidAfterCancellation: z.boolean().nullish(),
  createdAt: z.string(),
});
export type OrderListItem = z.infer<typeof orderListItemSchema>;

export const orderListSchema = z.looseObject({
  items: z.array(orderListItemSchema),
  total: z.number().int().optional(),
});

export const orderDetailSchema = z.looseObject({
  id: z.string(),
  orderNumber: z.number().int(),
  status: z.enum(OrderStatus),
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  deliveryMethod: z.string(),
  deliveryAddress: z.string().nullable(),
  subtotalKobo: z.number().int(),
  deliveryFeeKobo: z.number().int(),
  discountKobo: z.number().int(),
  totalKobo: z.number().int(),
  hasStockIssue: z.boolean(),
  // Nullish so a response cached before this field existed still parses.
  paidAfterCancellation: z.boolean().nullish(),
  internalNote: z.string().nullable(),
  createdAt: z.string(),
  // Nullish, not nullable: a response cached by a build older than these fields
  // must still parse rather than being thrown away on first launch.
  paymentFailedAt: z.string().nullish(),
  paymentFailureReason: z.string().nullish(),
  refundedAmountKobo: z.number().int().nullish(),
  disputedAt: z.string().nullish(),
  disputeStatus: z.string().nullish(),
  disputeReason: z.string().nullish(),
  items: z.array(
    z.looseObject({
      id: z.string(),
      productName: z.string(),
      variantLabel: z.string().nullable(),
      quantity: z.number().int(),
      unitPriceKobo: z.number().int(),
    }),
  ),
});
export type OrderDetail = z.infer<typeof orderDetailSchema>;

export const productVariantSchema = z.looseObject({
  id: z.string(),
  value: z.string(),
  priceKobo: z.number().int().nullable(),
  stock: z.number().int(),
  isActive: z.boolean(),
  position: z.number().int(),
});

export const productListItemSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  sku: z.string().nullable(),
  priceKobo: z.number().int(),
  stock: z.number().int(),
  isActive: z.boolean(),
  optionName: z.string().nullable(),
  imageUrls: z.array(z.string()),
  variants: z.array(productVariantSchema).optional(),
});
export type ProductListItem = z.infer<typeof productListItemSchema>;

export const productListSchema = z.looseObject({
  items: z.array(productListItemSchema),
  total: z.number().int().optional(),
});

export const categoryListSchema = z.looseObject({
  items: z.array(
    z.looseObject({ id: z.string(), name: z.string(), slug: z.string() }),
  ),
});

export const uploadConfigSchema = z.looseObject({
  cloudName: z.string(),
  apiKey: z.string(),
  folder: z.string(),
  /** Optional so an app build newer than the server still parses. */
  brandingFolder: z.string().optional(),
});

/**
 * The signature plus the constraints the server baked into it.
 *
 * `enforced` must be echoed back on the upload verbatim — Cloudinary rejects a
 * signature that does not cover the request exactly — which is what makes the
 * size and format limits binding rather than a suggestion the client can drop.
 */
export const uploadSignatureSchema = z.looseObject({
  signature: z.string(),
  enforced: z
    .looseObject({ allowed_formats: z.string() })
    .optional(),
});

export const storeSettingsResponseSchema = z.looseObject({
  name: z.string(),
  slug: z.string(),
  tagline: z.string().nullable(),
  primaryColor: z.string().nullable(),
  logoPublicId: z.string().nullable(),
  logoUrl: z.string().nullable(),
});
export type StoreSettings = z.infer<typeof storeSettingsResponseSchema>;
