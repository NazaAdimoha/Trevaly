import { z } from "zod";

/**
 * The section registry — one definition of every storefront section, read by
 * all three apps.
 *
 *   web     renders it
 *   api     validates it (the Zod schema below is generated from the fields)
 *   mobile  BUILDS THE EDITING FORM FROM IT
 *
 * That third one is the reason this file exists in the shape it does. A theme
 * store's worth of sections means twenty-odd editing screens if the app has to
 * hand-write each one, and they drift the moment a setting is added. Describing
 * a section's settings as data instead means adding "Countdown bar" ships one
 * web component and one entry here, and the phone gets a working editor for it
 * with no app release.
 *
 * `status` is honest about what exists: the app only offers `ready` sections,
 * and the web renderer skips anything it does not know, so an old app build can
 * never white-screen a storefront.
 */

// ── Fields ──────────────────────────────────────────────────────────────────

type FieldBase = {
  key: string;
  label: string;
  /** Shown under the control in the editor. Say why, not what. */
  help?: string;
};

export type Field =
  | (FieldBase & { type: "text"; default?: string; max?: number; placeholder?: string })
  | (FieldBase & { type: "textarea"; default?: string; max?: number })
  | (FieldBase & { type: "richtext"; default?: string; max?: number })
  | (FieldBase & { type: "image"; default?: null })
  | (FieldBase & { type: "video"; default?: null })
  | (FieldBase & { type: "color"; default?: string })
  | (FieldBase & { type: "toggle"; default: boolean })
  | (FieldBase & { type: "number"; default: number; min?: number; max?: number; step?: number })
  | (FieldBase & { type: "range"; default: number; min: number; max: number; step?: number })
  | (FieldBase & { type: "select"; default: string; options: { value: string; label: string }[] })
  | (FieldBase & { type: "link"; default?: string })
  | (FieldBase & { type: "product"; default?: null })
  | (FieldBase & { type: "collection"; default?: null })
  | (FieldBase & { type: "datetime"; default?: string })
  | (FieldBase & {
      type: "blocks";
      /** What one repeatable item contains — a slide, a tile, an FAQ entry. */
      itemLabel: string;
      fields: Field[];
      min?: number;
      max: number;
    });

export type SectionStatus = "ready" | "planned";

export type SectionDefinition = {
  type: string;
  label: string;
  description: string;
  status: SectionStatus;
  /** Grouping in the app's "Add section" list. */
  group: "hero" | "products" | "content" | "social" | "commerce";
  /** Pages this may be placed on. */
  pages: PageKey[];
  /** Some sections only make sense once per page. */
  singleton?: boolean;
  fields: Field[];
};

export const PAGE_KEYS = ["home", "product", "collection"] as const;
export type PageKey = (typeof PAGE_KEYS)[number];

// ── Reusable field groups ───────────────────────────────────────────────────

const headingFields: Field[] = [
  { key: "eyebrow", type: "text", label: "Eyebrow", max: 60, placeholder: "New season" },
  { key: "heading", type: "text", label: "Heading", max: 120 },
  { key: "body", type: "textarea", label: "Body", max: 400 },
];

const ctaFields: Field[] = [
  { key: "ctaLabel", type: "text", label: "Button label", max: 40 },
  { key: "ctaHref", type: "link", label: "Button links to" },
];

const alignmentField: Field = {
  key: "align",
  type: "select",
  label: "Alignment",
  default: "left",
  options: [
    { value: "left", label: "Left" },
    { value: "center", label: "Centre" },
    { value: "right", label: "Right" },
  ],
};

// ── The library ─────────────────────────────────────────────────────────────

export const SECTIONS: SectionDefinition[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Full-width image or video with a headline and buttons. Can be shoppable.",
    status: "planned",
    group: "hero",
    pages: ["home", "collection"],
    fields: [
      { key: "image", type: "image", label: "Background image" },
      {
        key: "video",
        type: "video",
        label: "Background video",
        help: "Plays muted and loops. Takes priority over the image. A GIF works — we convert it to video so it loads roughly ten times faster.",
      },
      ...headingFields,
      ...ctaFields,
      { key: "secondaryLabel", type: "text", label: "Second button label", max: 40 },
      { key: "secondaryHref", type: "link", label: "Second button links to" },
      alignmentField,
      {
        key: "height",
        type: "select",
        label: "Height",
        default: "large",
        options: [
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
          { value: "full", label: "Full screen" },
        ],
      },
      {
        key: "overlay",
        type: "range",
        label: "Image darkening",
        default: 30,
        min: 0,
        max: 80,
        step: 5,
        help: "Keeps the headline readable over a busy photo.",
      },
      {
        key: "hotspots",
        type: "blocks",
        label: "Shoppable hotspots",
        itemLabel: "Hotspot",
        max: 6,
        help: "Tap a point on the image to place a dot, then attach a product.",
        fields: [
          { key: "x", type: "number", label: "Horizontal %", default: 50, min: 0, max: 100 },
          { key: "y", type: "number", label: "Vertical %", default: 50, min: 0, max: 100 },
          { key: "product", type: "product", label: "Product" },
        ],
      },
      {
        key: "addAllLabel",
        type: "text",
        label: "“Add all” button",
        max: 40,
        help: "Adds every hotspot product to the cart at once. Leave empty to hide.",
      },
    ],
  },

  {
    type: "slideshow",
    label: "Slideshow",
    description: "Several heroes that rotate.",
    status: "planned",
    group: "hero",
    pages: ["home"],
    fields: [
      { key: "autoplay", type: "toggle", label: "Rotate automatically", default: true },
      { key: "interval", type: "range", label: "Seconds per slide", default: 6, min: 3, max: 12 },
      {
        key: "slides",
        type: "blocks",
        label: "Slides",
        itemLabel: "Slide",
        min: 1,
        max: 5,
        fields: [
          { key: "image", type: "image", label: "Image" },
          ...headingFields,
          ...ctaFields,
          alignmentField,
        ],
      },
    ],
  },

  {
    type: "collection-row",
    label: "Products from a collection",
    description: "A grid or carousel of products. Can be ranked, like a Top 10.",
    status: "ready",
    group: "products",
    pages: ["home", "collection", "product"],
    fields: [
      { key: "collection", type: "collection", label: "Collection" },
      ...headingFields.slice(0, 2),
      {
        key: "layout",
        type: "select",
        label: "Layout",
        default: "grid",
        options: [
          { value: "grid", label: "Grid" },
          { value: "carousel", label: "Carousel" },
          { value: "ranked", label: "Ranked (1, 2, 3…)" },
        ],
      },
      { key: "count", type: "range", label: "How many", default: 8, min: 2, max: 24 },
      { key: "showSwatches", type: "toggle", label: "Show colour swatches", default: true },
      { key: "quickAdd", type: "toggle", label: "Quick add button", default: true },
      ...ctaFields,
    ],
  },

  {
    type: "tabbed-products",
    label: "Product tabs",
    description: "New arrivals, best sellers and sale in one switchable carousel.",
    status: "planned",
    group: "products",
    pages: ["home"],
    fields: [
      {
        key: "tabs",
        type: "blocks",
        label: "Tabs",
        itemLabel: "Tab",
        min: 1,
        max: 4,
        fields: [
          { key: "label", type: "text", label: "Tab label", max: 24 },
          { key: "collection", type: "collection", label: "Collection" },
        ],
      },
      { key: "count", type: "range", label: "Products per tab", default: 8, min: 2, max: 16 },
    ],
  },

  {
    type: "category-tiles",
    label: "Category tiles",
    description: "Shop-by-category images in a row.",
    status: "planned",
    group: "products",
    pages: ["home"],
    fields: [
      ...headingFields.slice(0, 2),
      {
        key: "shape",
        type: "select",
        label: "Shape",
        default: "square",
        options: [
          { value: "square", label: "Square" },
          { value: "circle", label: "Circle" },
          { value: "tall", label: "Tall" },
        ],
      },
      {
        key: "items",
        type: "blocks",
        label: "Tiles",
        itemLabel: "Tile",
        min: 2,
        max: 8,
        fields: [
          { key: "image", type: "image", label: "Image" },
          { key: "label", type: "text", label: "Label", max: 40 },
          { key: "href", type: "link", label: "Links to" },
        ],
      },
    ],
  },

  {
    type: "promo-tiles",
    label: "Promotion tiles",
    description: "Two to four large images with a label that reveals on hover.",
    status: "planned",
    group: "content",
    pages: ["home"],
    fields: [
      ...headingFields.slice(0, 2),
      ...ctaFields,
      {
        key: "tiles",
        type: "blocks",
        label: "Tiles",
        itemLabel: "Tile",
        min: 2,
        max: 4,
        fields: [
          { key: "image", type: "image", label: "Image" },
          { key: "label", type: "text", label: "Label", max: 40 },
          { key: "href", type: "link", label: "Links to" },
        ],
      },
    ],
  },

  {
    type: "countdown",
    label: "Countdown",
    description: "A deadline on a sale. Days, hours, minutes, seconds.",
    status: "planned",
    group: "commerce",
    pages: ["home", "collection"],
    fields: [
      { key: "heading", type: "text", label: "Heading", max: 60, default: "Save 10% for" },
      { key: "endsAt", type: "datetime", label: "Ends at" },
      {
        key: "afterEnd",
        type: "select",
        label: "When it ends",
        default: "hide",
        options: [
          { value: "hide", label: "Hide the section" },
          { value: "message", label: "Show a message" },
        ],
      },
      { key: "endedMessage", type: "text", label: "Ended message", max: 80 },
      ...ctaFields,
    ],
  },

  {
    type: "marquee",
    label: "Scrolling strip",
    description: "Free shipping · 30-day returns · Secure checkout, moving slowly across the page.",
    status: "planned",
    group: "content",
    pages: ["home", "collection", "product"],
    fields: [
      {
        key: "items",
        type: "blocks",
        label: "Messages",
        itemLabel: "Message",
        min: 1,
        max: 8,
        fields: [{ key: "text", type: "text", label: "Text", max: 60 }],
      },
      { key: "speed", type: "range", label: "Speed", default: 40, min: 10, max: 90 },
    ],
  },

  {
    type: "image-with-text",
    label: "Image with text",
    description: "One image beside a paragraph. The workhorse for telling a brand story.",
    status: "planned",
    group: "content",
    pages: ["home", "collection", "product"],
    fields: [
      { key: "image", type: "image", label: "Image" },
      {
        key: "imageSide",
        type: "select",
        label: "Image on",
        default: "left",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      ...headingFields,
      ...ctaFields,
    ],
  },

  {
    type: "rich-text",
    label: "Text",
    description: "A heading and paragraph on their own, with an optional hand-drawn mark.",
    status: "ready",
    group: "content",
    pages: ["home", "collection", "product"],
    fields: [
      ...headingFields,
      alignmentField,
      {
        key: "annotation",
        type: "select",
        label: "Mark on the heading",
        default: "none",
        options: [
          { value: "none", label: "None" },
          { value: "circle", label: "Circled" },
          { value: "underline", label: "Underlined" },
        ],
      },
    ],
  },

  {
    type: "press",
    label: "Press",
    description: "A quote and the logos of who said it.",
    status: "planned",
    group: "social",
    pages: ["home"],
    fields: [
      { key: "eyebrow", type: "text", label: "Eyebrow", max: 40, default: "In the press" },
      { key: "quote", type: "textarea", label: "Quote", max: 300 },
      {
        key: "logos",
        type: "blocks",
        label: "Logos",
        itemLabel: "Logo",
        max: 8,
        fields: [
          { key: "image", type: "image", label: "Logo" },
          { key: "name", type: "text", label: "Publication", max: 40 },
        ],
      },
    ],
  },

  {
    type: "testimonials",
    label: "Reviews",
    description: "What customers said, in their words.",
    status: "planned",
    group: "social",
    pages: ["home", "product"],
    fields: [
      ...headingFields.slice(0, 2),
      {
        key: "items",
        type: "blocks",
        label: "Reviews",
        itemLabel: "Review",
        min: 1,
        max: 12,
        fields: [
          { key: "quote", type: "textarea", label: "Quote", max: 300 },
          { key: "author", type: "text", label: "Name", max: 60 },
          { key: "rating", type: "range", label: "Stars", default: 5, min: 1, max: 5 },
        ],
      },
    ],
  },

  {
    type: "gallery",
    label: "Photo wall",
    description: "Customer or campaign photos in a grid. Each can link to a product.",
    status: "planned",
    group: "social",
    pages: ["home"],
    fields: [
      { key: "heading", type: "text", label: "Heading", max: 60 },
      { key: "handle", type: "text", label: "Social handle", max: 40, placeholder: "@yourstore" },
      { key: "columns", type: "range", label: "Columns", default: 4, min: 2, max: 6 },
      {
        key: "items",
        type: "blocks",
        label: "Photos",
        itemLabel: "Photo",
        min: 1,
        max: 12,
        fields: [
          { key: "image", type: "image", label: "Photo" },
          { key: "product", type: "product", label: "Tagged product" },
        ],
      },
    ],
  },

  {
    type: "faq",
    label: "Questions",
    description: "The questions that stop someone buying, answered.",
    status: "planned",
    group: "content",
    pages: ["home", "product"],
    fields: [
      { key: "heading", type: "text", label: "Heading", max: 60, default: "Frequently asked questions" },
      { key: "openFirst", type: "toggle", label: "Open the first one", default: true },
      {
        key: "items",
        type: "blocks",
        label: "Questions",
        itemLabel: "Question",
        min: 1,
        max: 20,
        fields: [
          { key: "question", type: "text", label: "Question", max: 160 },
          { key: "answer", type: "richtext", label: "Answer", max: 1200 },
        ],
      },
    ],
  },

  {
    type: "video",
    label: "Video",
    description: "One video, with a still frame until it plays.",
    status: "planned",
    group: "content",
    pages: ["home", "product"],
    fields: [
      { key: "video", type: "video", label: "Video" },
      { key: "poster", type: "image", label: "Cover image" },
      ...headingFields.slice(0, 2),
      { key: "autoplay", type: "toggle", label: "Play automatically (muted)", default: false },
    ],
  },

  {
    type: "newsletter",
    label: "Email sign-up",
    description: "Collect an email address, with a reason to give it.",
    status: "planned",
    group: "commerce",
    pages: ["home"],
    singleton: true,
    fields: [
      { key: "heading", type: "text", label: "Heading", max: 60, default: "Stay in the loop" },
      { key: "body", type: "textarea", label: "Body", max: 200 },
      { key: "buttonLabel", type: "text", label: "Button label", max: 30, default: "Sign up" },
      { key: "consent", type: "text", label: "Small print", max: 200 },
    ],
  },

  {
    type: "bundle",
    label: "Bundle builder",
    description: "Pick several pieces, get a discount, one checkout.",
    status: "planned",
    group: "commerce",
    pages: ["home", "product"],
    fields: [
      ...headingFields.slice(0, 2),
      { key: "collection", type: "collection", label: "Pick from" },
      { key: "pieces", type: "range", label: "Pieces in a bundle", default: 4, min: 2, max: 6 },
      { key: "discountPercent", type: "range", label: "Discount %", default: 10, min: 1, max: 50 },
    ],
  },
];

export const SECTIONS_BY_TYPE: Record<string, SectionDefinition> = Object.fromEntries(
  SECTIONS.map((section) => [section.type, section]),
);

export function sectionDefinition(type: string): SectionDefinition | undefined {
  return SECTIONS_BY_TYPE[type];
}

/** What the app offers in "Add section", for one page. */
export function availableSections(page: PageKey): SectionDefinition[] {
  return SECTIONS.filter((s) => s.status === "ready" && s.pages.includes(page));
}

// ── Validation ──────────────────────────────────────────────────────────────

/**
 * A Zod schema for one field, derived from its declaration.
 *
 * Everything is optional at the settings level on purpose: a merchant saves a
 * half-filled section constantly (they are on a phone, between customers), and
 * the renderer already has to handle a hero with no heading. Rejecting a draft
 * mid-edit would lose their work. What IS enforced is shape and bounds — a
 * number stays a number, text stays within its limit, a select stays inside its
 * options — so nothing unrenderable ever reaches the storefront.
 */
function fieldSchema(field: Field): z.ZodTypeAny {
  switch (field.type) {
    case "text":
    case "textarea":
    case "richtext":
      return z.string().max(field.max ?? 2000).nullish();
    case "image":
    case "video":
      // A Cloudinary public ID, checked against the store's own folder by the API.
      return z.string().max(300).nullish();
    case "color":
      return z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .nullish();
    case "toggle":
      return z.boolean().nullish();
    case "number":
    case "range": {
      let schema = z.number();
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      return schema.nullish();
    }
    case "select":
      return z.enum(field.options.map((o) => o.value) as [string, ...string[]]).nullish();
    case "link":
      return z.string().max(500).nullish();
    case "product":
    case "collection":
      return z.string().max(100).nullish();
    case "datetime":
      return z.iso.datetime().nullish();
    case "blocks":
      return z
        .array(
          z.object(
            Object.fromEntries(field.fields.map((f) => [f.key, fieldSchema(f)])),
          ),
        )
        .max(field.max)
        .nullish();
  }
}

export function sectionSettingsSchema(type: string): z.ZodTypeAny | null {
  const definition = sectionDefinition(type);
  if (!definition) return null;
  return z
    .object(Object.fromEntries(definition.fields.map((f) => [f.key, fieldSchema(f)])))
    .strict();
}

/** The defaults a freshly added section starts with. */
export function defaultSettings(type: string): Record<string, unknown> {
  const definition = sectionDefinition(type);
  if (!definition) return {};

  const settings: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (field.type === "blocks") {
      settings[field.key] = [];
      continue;
    }
    if ("default" in field && field.default !== undefined) {
      settings[field.key] = field.default;
    }
  }
  return settings;
}
