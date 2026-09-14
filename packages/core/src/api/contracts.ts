import { z } from "zod";

import {
  OrderStatus,
  StorefrontTheme,
  TenantRole,
  TenantStatus,
} from "../enums";

/**
 * The wire contract between the API and its clients.
 *
 * Declared once and used from both directions: route handlers are typed against
 * these, and the mobile client parses responses with the schemas. Drift becomes
 * a build error in the web app and a loud runtime failure on the phone, rather
 * than `undefined` rendering in a merchant's order list.
 *
 * ## Additive-only
 *
 * A mobile client is versioned by the App Store, not by your deploy — a merchant
 * on v1.2 will still be calling this three months after v1.5 ships. So: never
 * rename a field, never change a type, never remove one. Add, and deprecate in a
 * comment. Every schema here is `.passthrough()`-safe for that reason: an older
 * app ignores fields it does not know about.
 */

export const storeSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: z.enum(TenantStatus),
  theme: z.enum(StorefrontTheme),
  role: z.enum(TenantRole),
  logoUrl: z.string().nullable(),
  currency: z.string(),
  /**
   * The public storefront address, resolved server-side.
   *
   * The client cannot build this itself: whether a store answers on its own
   * domain or on `{slug}.{root}` depends on `customDomainVerified`, which the
   * app has no business knowing. Sharing the wrong one sends a customer to a
   * host that does not serve that store.
   */
  storefrontUrl: z.string(),
});
export type StoreSummary = z.infer<typeof storeSummarySchema>;

export const myStoresResponseSchema = z.object({
  items: z.array(storeSummarySchema),
});
export type MyStoresResponse = z.infer<typeof myStoresResponseSchema>;

/**
 * The numbers the merchant sees first, on the web dashboard home and on the
 * app's Today screen. One query set serves both, so the two cannot disagree
 * about how much the store has taken.
 */
export const storeOverviewResponseSchema = z.object({
  store: z.object({
    name: z.string(),
    slug: z.string(),
    status: z.enum(TenantStatus),
    /**
     * A full remote URL, not a Cloudinary public ID — tenant logos may be
     * hosted anywhere, which is why the storefront renders them with a plain
     * `<img>` rather than `next/image`.
     *
     * `nullish` rather than `nullable` on purpose: a merchant may have no logo,
     * AND a response cached by a build older than this field must still parse
     * rather than being discarded. Clients fall back to a monogram.
     */
    logoUrl: z.string().nullish(),
    /** See `storeSummarySchema.storefrontUrl`. Nullish for cache compatibility. */
    storefrontUrl: z.string().nullish(),
  }),
  stats: z.object({
    productCount: z.number().int(),
    activeProducts: z.number().int(),
    paidOrders: z.number().int(),
    pendingOrders: z.number().int(),
    /** Integer kobo, like every other amount in the system. */
    revenueKobo: z.number().int(),
    /** Orders that were paid but could not be stocked — needs a human. */
    needsAttention: z.number().int(),
    /** New customers in the window, counted by distinct email. */
    newCustomers: z.number().int().nullish(),
  }),
  /** Which window `stats` covers. Nullish for cache compatibility. */
  period: z.enum(['week', 'month', 'all', 'custom']).nullish(),
  /**
   * The window the server actually applied, echoed back as ISO strings.
   *
   * Echoed rather than assumed: the client sends a request and the server
   * resolves it (an invalid range degrades to unbounded), so the only way a
   * screen can label a figure honestly is to render the range the server used,
   * not the one it asked for.
   */
  range: z
    .object({ from: z.string().nullable(), to: z.string().nullable() })
    .nullish(),
  /**
   * Change against the previous window of the same length.
   *
   * `null` rather than 0 when there is nothing to compare against — a store
   * with no history last week has not grown 0%, it has no comparison, and
   * rendering "0% from last week" for a brand new store is a lie.
   */
  deltas: z
    .object({
      revenuePercent: z.number().nullable(),
      paidOrdersPercent: z.number().nullable(),
    })
    .nullish(),
});
export type StoreOverviewResponse = z.infer<typeof storeOverviewResponseSchema>;

/**
 * Fetched on launch, before anything else.
 *
 * `minimumVersion` is what makes a breaking change shippable at all: without a
 * gate the oldest installed build constrains the API forever. Ship it in v1
 * even while it always answers "you are fine".
 */
export const appConfigResponseSchema = z.object({
  minimumVersion: z.string(),
  /** Shown when the installed build is below `minimumVersion`. */
  updateMessage: z.string(),
  /** Server-driven, so a half-built screen can be dark-launched. */
  features: z.record(z.string(), z.boolean()),
  /** Where to send a merchant for the tasks the app deliberately does not do. */
  webDashboardUrl: z.string(),
  /**
   * Needed by any client that renders product imagery from a stored public ID.
   * `Product.imageUrls` holds Cloudinary public IDs, never delivery URLs — the
   * client derives format, quality and crop at render time, which is the whole
   * reason IDs are stored. The web gets this from its own env; the app has to
   * be told.
   */
  cloudinaryCloudName: z.string().nullable(),
});
export type AppConfigResponse = z.infer<typeof appConfigResponseSchema>;

export const orderStatusSchema = z.enum(OrderStatus);

/** Compares dotted versions without pulling in semver. */
export function isVersionBelow(current: string, minimum: string): boolean {
  const parse = (value: string) =>
    value.split(".").map((part) => Number.parseInt(part, 10) || 0);

  const a = parse(current);
  const b = parse(minimum);

  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const left = a[i] ?? 0;
    const right = b[i] ?? 0;
    if (left !== right) return left < right;
  }
  return false;
}
