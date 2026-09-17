import { z } from "zod";

import { StorefrontTheme } from "../enums";
import { RESERVED_SUBDOMAINS } from "../reserved";

/**
 * Tenant onboarding input.
 *
 * The slug is the load-bearing field: it becomes `{slug}.yourbrand.com`, and
 * the web proxy resolves hostnames straight to it. A slug that collides with a
 * reserved subdomain would make `admin.yourbrand.com` serve a storefront, so
 * the same `RESERVED_SUBDOMAINS` set that guards request time also guards
 * creation time — checking in one place only means the other stays exploitable.
 */
export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "At least 3 characters")
  .max(40, "At most 40 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Lowercase letters, numbers and hyphens only",
  )
  .refine((slug) => !RESERVED_SUBDOMAINS.has(slug), {
    message: "That subdomain is reserved",
  });

export const tenantOnboardingSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema,
  /** Who will own the store. The Clerk account is linked when they sign up. */
  ownerEmail: z.email().max(200),
  contactEmail: z.email().max(200).optional().or(z.literal("")),
  tagline: z.string().trim().max(200).optional().or(z.literal("")),

  /**
   * Storefront look. A closed enum, never a free string — this value ends up
   * selecting CSS on a shared domain, and the one thing that must never be
   * possible is a tenant supplying their own.
   */
  theme: z.enum(StorefrontTheme).default(StorefrontTheme.CLASSIC),

  // Settlement. Funds go directly to this account via the Paystack split.
  bankCode: z.string().trim().min(3).max(10),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{10}$/, "A Nigerian account number is 10 digits"),

  /**
   * Platform cut. Capped well below anything that could be entered by accident
   * — a fat-fingered 50 here silently takes half of every order the tenant ever
   * sells, and Paystack applies it at settlement without further confirmation.
   */
  platformFeePercent: z.coerce.number().min(0).max(10),
});

export type TenantOnboardingPayload = z.infer<typeof tenantOnboardingSchema>;

/** Derives a subdomain from a business name as the operator types. */
export function slugifyTenantName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
