import { z } from "zod";

import { toCsv } from "../csv";
import { slugifyCategory } from "./category";

/**
 * The CSV product import.
 *
 * §4 of the pricing breakdown names this as the thing that saves hours per
 * client, and it is what makes a 1–3 hour onboarding realistic instead of
 * thirty trips through a form. Everything here is shaped around a merchant
 * handing over a spreadsheet they already keep, not around our data model.
 *
 * Deliberate leniency: headers are matched case- and space-insensitively,
 * money is accepted with or without a currency symbol or thousands separators,
 * and unknown columns are ignored. Deliberate strictness: a row that cannot be
 * priced, named or slugged is rejected with a reason rather than guessed at.
 */

export type ImportRowError = { row: number; message: string };

export type ParsedImportRow = {
  /** 1-based, counting the header, so it matches what the merchant sees. */
  row: number;
  name: string;
  slug: string;
  sku: string | null;
  description: string | null;
  priceKobo: number;
  stock: number;
  categoryName: string | null;
  optionName: string | null;
  variants: Array<{ value: string; stock: number; priceKobo: number | null }>;
  imageUrls: string[];
};

export type ImportPreview = {
  rows: ParsedImportRow[];
  errors: ImportRowError[];
  /** Categories referenced that do not exist yet and would be created. */
  newCategories: string[];
};

const COLUMNS = {
  name: ["name", "productname", "product", "title"],
  slug: ["slug", "url", "handle"],
  sku: ["sku", "code", "productcode"],
  description: ["description", "details", "desc"],
  price: ["price", "amount", "cost", "pricengn", "price₦"],
  stock: ["stock", "quantity", "qty", "instock"],
  category: ["category", "group", "collection"],
  option: ["option", "optionname", "variesby", "varies"],
  variants: ["variants", "options", "sizes"],
  images: ["images", "image", "imageurl", "imageurls", "photo", "photos"],
} as const;

function pick(record: Record<string, string>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

/** "₦25,000.50" / "25000" / "25 000" -> integer kobo. */
export function parseMoneyToKobo(input: string): number | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  if (cleaned === "") return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;

  return Math.round(value * 100);
}

export function slugifyProduct(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/**
 * `S=4;M=6;L=3;XL=2@28000`
 *
 * `value=stock`, optionally `@price` to override the product price for that one
 * option. Semicolons separate, because commas are already the column separator
 * and a merchant editing in Excel will not think about escaping.
 */
export function parseVariantSpec(input: string): {
  variants: ParsedImportRow["variants"];
  error: string | null;
} {
  const variants: ParsedImportRow["variants"] = [];
  const seen = new Set<string>();

  for (const part of input.split(";")) {
    const chunk = part.trim();
    if (!chunk) continue;

    const [rawValue = "", rawRest = ""] = chunk.split("=");
    const value = rawValue.trim();
    if (!value)
      return { variants: [], error: `Could not read option "${chunk}"` };

    const key = value.toLowerCase();
    if (seen.has(key)) {
      return { variants: [], error: `Option "${value}" is listed twice` };
    }
    seen.add(key);

    const [rawStock = "", rawPrice] = rawRest.split("@");
    const stock = Number(rawStock.trim() || "0");
    if (!Number.isInteger(stock) || stock < 0) {
      return { variants: [], error: `"${value}" needs a whole-number stock` };
    }

    let priceKobo: number | null = null;
    if (rawPrice !== undefined && rawPrice.trim() !== "") {
      priceKobo = parseMoneyToKobo(rawPrice);
      if (priceKobo === null) {
        return { variants: [], error: `"${value}" has an unreadable price` };
      }
    }

    variants.push({ value, stock, priceKobo });
  }

  return { variants, error: null };
}

/** Only https, and only what Cloudinary will be asked to fetch. */
function parseImageUrls(input: string): string[] {
  return input
    .split(/[|\s]+/)
    .map((url) => url.trim())
    .filter((url) => url.startsWith("https://"))
    .slice(0, 8);
}

export function buildImportPreview(
  records: Array<Record<string, string>>,
  existingCategoryNames: ReadonlyArray<string>,
): ImportPreview {
  const rows: ParsedImportRow[] = [];
  const errors: ImportRowError[] = [];
  const knownCategories = new Set(
    existingCategoryNames.map((name) => name.toLowerCase()),
  );
  const newCategories = new Set<string>();
  const slugsSeen = new Map<string, number>();

  records.forEach((record, index) => {
    // +2: one for the header, one because humans count from 1.
    const row = index + 2;
    const name = pick(record, COLUMNS.name).trim();

    if (!name) {
      errors.push({ row, message: "No product name" });
      return;
    }

    const priceKobo = parseMoneyToKobo(pick(record, COLUMNS.price));
    if (priceKobo === null) {
      errors.push({ row, message: `"${name}" has no readable price` });
      return;
    }

    const slug = slugifyProduct(pick(record, COLUMNS.slug) || name);
    if (!slug) {
      errors.push({ row, message: `"${name}" produces an empty web address` });
      return;
    }

    // Catch collisions inside the file itself, not just against the database —
    // otherwise the first half imports and the second half fails mid-run.
    const previous = slugsSeen.get(slug);
    if (previous) {
      errors.push({
        row,
        message: `"${name}" clashes with row ${previous} (both become /${slug})`,
      });
      return;
    }
    slugsSeen.set(slug, row);

    const rawStock = pick(record, COLUMNS.stock);
    const stock = rawStock === "" ? 0 : Number(rawStock.replace(/[^\d]/g, ""));
    if (!Number.isInteger(stock) || stock < 0) {
      errors.push({ row, message: `"${name}" has an unreadable stock figure` });
      return;
    }

    const { variants, error: variantError } = parseVariantSpec(
      pick(record, COLUMNS.variants),
    );
    if (variantError) {
      errors.push({ row, message: `"${name}": ${variantError}` });
      return;
    }

    const optionName = pick(record, COLUMNS.option).trim() || null;
    if (variants.length > 0 && !optionName) {
      errors.push({
        row,
        message: `"${name}" lists options but no "option" column value (e.g. Size)`,
      });
      return;
    }

    const categoryName = pick(record, COLUMNS.category).trim() || null;
    if (categoryName && !knownCategories.has(categoryName.toLowerCase())) {
      newCategories.add(categoryName);
    }

    rows.push({
      row,
      name,
      slug,
      sku: pick(record, COLUMNS.sku).trim() || null,
      description: pick(record, COLUMNS.description).trim() || null,
      priceKobo,
      // Stock is per option once options exist; the column is then ignored.
      stock: variants.length > 0 ? 0 : stock,
      categoryName,
      optionName: variants.length > 0 ? optionName : null,
      variants,
      imageUrls: parseImageUrls(pick(record, COLUMNS.images)),
    });
  });

  return { rows, errors, newCategories: [...newCategories] };
}

/** The starter file, offered as a download so nobody has to guess the columns. */
export function importTemplateCsv(): string {
  return toCsv([
    [
      "name",
      "price",
      "stock",
      "sku",
      "category",
      "description",
      "option",
      "variants",
      "images",
    ],
    [
      "Ankara Midi Dress",
      "25000",
      "",
      "ANK-001",
      "Dresses",
      "Cotton Ankara, fully lined.",
      "Size",
      "S=4;M=6;L=3;XL=2@28000",
      "",
    ],
    [
      "Raffia Tote Bag",
      "18000",
      "12",
      "BAG-014",
      "Bags",
      "Hand-woven, leather handles.",
      "",
      "",
      "https://example.com/tote.jpg",
    ],
    ["Silk Head Wrap", "8500", "25", "", "Accessories", "", "", "", ""],
  ]);
}

/** Suggests a category slug the same way the admin form would. */
export const importCategorySlug = slugifyCategory;

/** Body of the product import endpoint. */
export const importRequestSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
  /** Preview by default. Nothing is written until the merchant confirms. */
  commit: z.boolean().default(false),
});
