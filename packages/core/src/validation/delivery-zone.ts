import { z } from "zod";

/** A delivery zone as created from the dashboard. */
export const deliveryZoneWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  // Free delivery is legitimate, so zero is allowed — unlike a product price.
  feeKobo: z.number().int().min(0),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

/** Every field optional — a PATCH must not require echoing back the rest. */
export const deliveryZoneUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  feeKobo: z.number().int().min(0).optional(),
  position: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export type DeliveryZoneWritePayload = z.infer<typeof deliveryZoneWriteSchema>;
