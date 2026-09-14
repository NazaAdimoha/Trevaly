import { z } from "zod";

import { StorefrontTheme } from "../enums";
import { isOwnedBy } from "../media/folder";

/**
 * What a merchant may change about their own store from the app.
 *
 * Deliberately NOT here: `slug`, `status`, `customDomain`, anything about
 * payouts. The slug is baked into every link a customer has ever been sent,
 * status is the platform's call, and the settlement account is changed through
 * Paystack with their own verification — a store-settings form is the wrong
 * place to move where money lands.
 *
 * Every field is optional: this is a PATCH, and a client sending one changed
 * field must not have to echo back the rest and risk clobbering a concurrent
 * edit.
 */
export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  tagline: z.string().trim().max(140).nullable().optional(),
  /**
   * A Cloudinary public ID, never a URL. Validated against the store's own
   * folder by the route — a public ID is a pointer to someone's asset, and
   * accepting an arbitrary one lets a merchant set another store's logo (or an
   * unrelated image) as their own.
   */
  logoPublicId: z.string().trim().max(300).nullable().optional(),
  /**
   * Which storefront layout the shop renders with. Changing it is instant and
   * reversible — it swaps a token set, never the catalogue.
   */
  theme: z.enum(StorefrontTheme).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a six-digit hex colour like #4DBF7D")
    .nullable()
    .optional(),
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

/** True when the id is absent, cleared, or genuinely this store's. */
export function logoBelongsToStore(
  logoPublicId: string | null | undefined,
  storeSlug: string,
): boolean {
  if (logoPublicId === undefined || logoPublicId === null) return true;
  return isOwnedBy(logoPublicId, storeSlug);
}

/**
 * Mask an email for display on a page whose only credential is a URL.
 *
 * `adaobi@gmail.com` -> `a•••i@gmail.com`
 *
 * The order confirmation page is reachable by anyone holding the payment
 * reference, and those links get forwarded and pasted into WhatsApp groups.
 * Enough survives for a customer to recognise their own address; not enough for
 * a stranger to harvest it.
 *
 * The domain is kept: it carries no identity on its own and is what makes the
 * masked address recognisable at a glance.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";

  const local = email.slice(0, at);
  const domain = email.slice(at);

  if (local.length <= 2) return `${local[0]}•••${domain}`;
  return `${local[0]}•••${local[local.length - 1]}${domain}`;
}
