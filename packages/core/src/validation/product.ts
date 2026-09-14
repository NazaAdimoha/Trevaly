import { z } from "zod";

/**
 * A Cloudinary public ID, e.g. `tenants/adaobi-store/products/ab12cd`.
 *
 * `imageUrls` holds these rather than delivery URLs, so the column name is now
 * a slight misnomer. The trade is deliberate: a stored URL freezes whatever
 * transformation was applied at upload time, and changing how images render
 * later would mean rewriting every row. `CldImage` derives format, quality and
 * crop from the ID at render time instead.
 *
 * Shape only — that a caller may attach *this* id is checked in the route,
 * where the tenant is known.
 */
export const cloudinaryPublicIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .regex(/^[A-Za-z0-9][A-Za-z0-9/_.-]*$/, "Not a valid image reference");

/**
 * Product write contract.
 *
 * `priceKobo` is an integer in kobo, matching the schema. The admin form takes
 * naira and converts with `toMinor()` before submitting — the API never accepts
 * a naira float, because a rounding error here is a mispriced product.
 */
/**
 * One buyable option. `id` is present when editing an existing variant and
 * absent when adding one — the route uses it to decide update versus create,
 * and always re-checks that the id belongs to this product.
 */
export const productVariantWriteSchema = z.object({
  id: z.string().min(1).optional(),
  value: z.string().trim().min(1, "Give the option a name").max(60),
  sku: z.string().trim().max(64).optional().or(z.literal("")),
  /** Null inherits the product price; 0 is never a valid override. */
  priceKobo: z.number().int().min(1).nullable().optional(),
  stock: z.number().int().min(0).max(1_000_000),
  isActive: z.boolean().default(true),
});

export const productWriteSchema = z.object({
  name: z.string().trim().min(2).max(200),
  slug: z
    .string()
    .trim()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Use lowercase letters, numbers and hyphens",
    )
    .min(2)
    .max(120),
  description: z.string().trim().max(5000).optional().or(z.literal("")),
  sku: z.string().trim().max(64).optional().or(z.literal("")),
  priceKobo: z.number().int().min(1, "Price must be greater than zero"),
  stock: z.number().int().min(0).max(1_000_000),
  imageUrls: z.array(cloudinaryPublicIdSchema).max(8).default([]),
  categoryId: z.string().min(1).optional().or(z.literal("")),
  isActive: z.boolean().default(true),

  optionName: z.string().trim().max(40).optional().or(z.literal("")),
  variants: z.array(productVariantWriteSchema).max(30).default([]),
});

export const productUpdateSchema = productWriteSchema.partial();

/**
 * A product either sells as one thing or by option, never half of each.
 *
 * Enforced here rather than in the route so create and update cannot disagree.
 * The duplicate check matters because `@@unique([productId, value])` would
 * otherwise surface as a raw Prisma constraint error the merchant cannot act on.
 */
export function variantRejectionReason(input: {
  optionName?: string | null;
  variants?: Array<{ value: string }>;
}): string | null {
  const variants = input.variants ?? [];
  const optionName = (input.optionName ?? "").trim();

  if (variants.length > 0 && !optionName) {
    return 'Name what the options are — "Size", "Colour", "Weight".';
  }
  if (optionName && variants.length === 0) {
    return `Add at least one ${optionName.toLowerCase()}, or clear the option name.`;
  }

  const seen = new Set<string>();
  for (const variant of variants) {
    const key = variant.value.trim().toLowerCase();
    if (seen.has(key)) return `"${variant.value}" is listed twice.`;
    seen.add(key);
  }

  return null;
}

export type ProductWritePayload = z.infer<typeof productWriteSchema>;

export const productListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  isActive: z.enum(["true", "false"]).optional(),
  categoryId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** Normalises optional text fields: '' from a form means "unset", not empty. */
export function emptyToNull<T extends Record<string, unknown>>(
  input: T,
  keys: ReadonlyArray<keyof T>,
): T {
  const output = { ...input };
  for (const key of keys) {
    if (output[key] === "") output[key] = null as T[keyof T];
  }
  return output;
}
