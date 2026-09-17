import { z } from "zod";

import {
  type Field,
  PAGE_KEYS,
  type PageKey,
  sectionDefinition,
  sectionSettingsSchema,
} from "./registry";
import { PRESET_KEYS, type PresetKey, tokenOverridesSchema } from "./tokens";

/**
 * A storefront layout: what a store looks like, as data.
 *
 * Stored twice per tenant — a `draft` the merchant edits and a `published` one
 * shoppers see. That split is the whole reason a phone is a safe place to
 * redesign a shop: a half-finished hero sits in the draft until they press
 * publish, and reverting is one tap because the previous published version is
 * still there.
 *
 * Validated here, in the shared core, so the API, the web renderer and the app
 * editor cannot disagree about what a valid layout is.
 */

export const sectionSchema = z.object({
  /** Stable across reorders — the app's list keys and the editor depend on it. */
  id: z.string().min(1).max(40),
  type: z.string().min(1).max(60),
  visible: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).default({}),
});

export type Section = z.infer<typeof sectionSchema>;

export const headerSchema = z
  .object({
    layout: z.enum(["classic", "centred", "floating"]).default("classic"),
    /** Sits over the hero until the shopper scrolls. Needs a hero to look right. */
    transparentOverHero: z.boolean().default(false),
    sticky: z.boolean().default(true),
    showSearch: z.boolean().default(true),
    showAccount: z.boolean().default(true),
    showCurrency: z.boolean().default(false),
    menu: z
      .array(
        z.object({
          label: z.string().max(40),
          href: z.string().max(500),
          /** One level of children is a menu; two is a sitemap nobody reads. */
          children: z
            .array(
              z.object({
                label: z.string().max(40),
                href: z.string().max(500),
                image: z.string().max(300).nullish(),
              }),
            )
            .max(12)
            .default([]),
        }),
      )
      .max(8)
      .default([]),
  })
  .strict();

export const announcementSchema = z
  .object({
    enabled: z.boolean().default(false),
    messages: z.array(z.string().max(120)).max(5).default([]),
    href: z.string().max(500).nullish(),
    dismissible: z.boolean().default(true),
    /** "You're ₦5,000 away from free shipping" — reads the cart total. */
    freeShippingThresholdKobo: z.number().int().min(0).nullish(),
  })
  .strict();

export const footerSchema = z
  .object({
    newsletter: z.boolean().default(true),
    newsletterHeading: z.string().max(60).default("Stay in the loop"),
    newsletterBody: z.string().max(200).default(""),
    /** The oversized wordmark both reference themes end on. */
    wordmark: z.boolean().default(true),
    showPaymentIcons: z.boolean().default(true),
    showCurrency: z.boolean().default(false),
    columns: z
      .array(
        z.object({
          heading: z.string().max(40),
          links: z
            .array(z.object({ label: z.string().max(40), href: z.string().max(500) }))
            .max(8)
            .default([]),
        }),
      )
      .max(4)
      .default([]),
    socials: z
      .array(
        z.object({
          platform: z.enum(["instagram", "facebook", "tiktok", "x", "youtube", "whatsapp"]),
          href: z.string().max(500),
        }),
      )
      .max(6)
      .default([]),
  })
  .strict();

export const mobileBarSchema = z
  .object({
    enabled: z.boolean().default(true),
    /**
     * `account` stays in the enum for when customers can sign in, but it is not
     * in the default: a tab that leads nowhere is worse than one fewer tab.
     * Four is also the point at which labels stay readable at 390px.
     */
    items: z
      .array(z.enum(["home", "menu", "search", "shop", "cart", "account"]))
      .max(5)
      .default(["home", "menu", "search", "cart"]),
  })
  .strict();

export const layoutSchema = z
  .object({
    /** Schema version, so an old app build can be told to update rather than guess. */
    version: z.literal(1).default(1),
    preset: z.enum(PRESET_KEYS).default("momentum"),
    tokens: tokenOverridesSchema.default(() => ({})),
    /**
     * Defaults are produced by PARSING an empty object, not by handing Zod a
     * literal. A literal `{}` is returned as-is, so a layout built by
     * `defaultLayout()` would carry `mobileBar: {}` while the same layout read
     * back from the database carried the filled-in version — the editor would
     * then show a change nobody made. Functions also stop two layouts sharing
     * one mutable array.
     */
    announcement: announcementSchema.default(() => announcementSchema.parse({})),
    header: headerSchema.default(() => headerSchema.parse({})),
    footer: footerSchema.default(() => footerSchema.parse({})),
    mobileBar: mobileBarSchema.default(() => mobileBarSchema.parse({})),
    pages: z
      .object({
        home: z.array(sectionSchema).max(20).default(() => []),
        product: z.array(sectionSchema).max(10).default(() => []),
        collection: z.array(sectionSchema).max(10).default(() => []),
      })
      .default(() => ({ home: [], product: [], collection: [] })),
  })
  .strict();

export type StorefrontLayout = z.infer<typeof layoutSchema>;

/**
 * Parse a stored layout, dropping anything unrenderable rather than failing.
 *
 * A storefront must render. If one section in a stored layout is malformed —
 * an app wrote a field this build does not know, a product was deleted — the
 * shop loses that section, never the page. Problems are returned so the API can
 * log them and the editor can flag them, but they never reach a shopper as an
 * error.
 */
export function parseLayout(input: unknown): {
  layout: StorefrontLayout;
  problems: string[];
} {
  const problems: string[] = [];
  const parsed = layoutSchema.safeParse(input);

  if (!parsed.success) {
    problems.push(...parsed.error.issues.map((i) => `${i.path.join(".") || "layout"}: ${i.message}`));
    return { layout: layoutSchema.parse({}), problems };
  }

  const layout = parsed.data;
  for (const page of PAGE_KEYS) {
    layout.pages[page] = layout.pages[page].filter((section) => {
      const schema = sectionSettingsSchema(section.type);
      if (!schema) {
        problems.push(`${page}: unknown section "${section.type}"`);
        return false;
      }
      const settings = schema.safeParse(section.settings);
      if (!settings.success) {
        problems.push(`${page}/${section.type}: ${settings.error.issues[0]?.message ?? "invalid"}`);
        return false;
      }
      section.settings = settings.data as Record<string, unknown>;
      return true;
    });
  }

  return { layout, problems };
}

/**
 * Every Cloudinary id a layout references.
 *
 * Section settings can carry images and videos, which means a layout is another
 * way to point at an asset — and the same hole product images and logos already
 * close: a public id is a pointer to SOMEONE's asset, so one store must not be
 * able to save another store's id into its hero. The API checks each of these
 * against the store's own folder before saving.
 *
 * Walks the registry rather than the object, so a field added later is covered
 * without anyone remembering to update this.
 */
export function mediaIds(layout: StorefrontLayout): string[] {
  const found: string[] = [];

  const visit = (fields: Field[], settings: Record<string, unknown>) => {
    for (const field of fields) {
      const value = settings?.[field.key];
      if (field.type === "image" || field.type === "video") {
        if (typeof value === "string" && value) found.push(value);
      } else if (field.type === "blocks" && Array.isArray(value)) {
        for (const block of value) {
          if (block && typeof block === "object") {
            visit(field.fields, block as Record<string, unknown>);
          }
        }
      }
    }
  };

  for (const page of PAGE_KEYS) {
    for (const section of layout.pages[page]) {
      const definition = sectionDefinition(section.type);
      if (definition) visit(definition.fields, section.settings);
    }
  }

  // Menu items carry promo imagery too.
  for (const item of layout.header.menu) {
    for (const child of item.children) {
      if (child.image) found.push(child.image);
    }
  }

  return [...new Set(found)];
}

/** A short, collision-resistant id for a new section. Not security-sensitive. */
export function sectionId(type: string): string {
  return `${type}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The layout a store starts with.
 *
 * Deliberately not empty. A merchant who opens the editor to a blank page
 * closes it again; one who opens it to a finished-looking shop edits the parts
 * that are wrong. Only sections that actually render are seeded.
 */
export function defaultLayout(preset: PresetKey = "momentum"): StorefrontLayout {
  return layoutSchema.parse({
    preset,
    announcement: {
      enabled: true,
      messages: ["Free delivery on orders over ₦50,000"],
      dismissible: true,
    },
    header: {
      layout: preset === "obsidian" ? "floating" : "classic",
      transparentOverHero: preset === "obsidian",
      showSearch: true,
    },
    footer: {
      newsletter: true,
      newsletterBody: "Get early access to new arrivals and exclusive offers.",
      wordmark: true,
      showPaymentIcons: true,
    },
    pages: {
      home: [
        {
          id: sectionId("collection-row"),
          type: "collection-row",
          visible: true,
          settings: {
            heading: "New arrivals",
            layout: "grid",
            count: 8,
            showSwatches: true,
            quickAdd: true,
          },
        },
      ],
      product: [],
      collection: [],
    },
  });
}

export type { PageKey };
