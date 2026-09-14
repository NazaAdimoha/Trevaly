import { z } from "zod";

/**
 * Category write contract.
 *
 * The slug is public — it becomes `/categories/{slug}` on the storefront — so
 * it is shaped here rather than derived server-side from the name, which would
 * silently change a live URL the moment a merchant fixes a typo in the name.
 *
 * Uniqueness is per tenant (`@@unique([tenantId, slug])`), never global: two
 * stores may both sell "dresses".
 */
export const categoryWriteSchema = z.object({
  name: z.string().trim().min(2, "Give the category a name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Lowercase letters, numbers and hyphens only",
    )
    .min(2)
    .max(80),
  position: z.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const categoryUpdateSchema = categoryWriteSchema.partial();

export type CategoryWritePayload = z.infer<typeof categoryWriteSchema>;

/** Derives a URL slug from a category name as the owner types. */
export function slugifyCategory(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
