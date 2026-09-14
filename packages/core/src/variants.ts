/**
 * Variant pricing and availability — the single source of truth.
 *
 * Every surface that asks "what does this cost" or "can this be bought" goes
 * through here: the catalogue grid, the product page, and `/api/checkout`. The
 * storefront's answer and the server's answer are then the same function, which
 * is what stops a shopper being quoted one price and charged another.
 *
 * Deliberately free of Prisma imports so it can be unit-tested and used from a
 * Client Component without dragging the runtime into the browser bundle.
 */

export type VariantLike = {
  id: string;
  value: string;
  priceKobo: number | null;
  stock: number;
  isActive: boolean;
  position: number;
};

export type ProductLike = {
  priceKobo: number;
  stock: number;
  optionName: string | null;
  variants: VariantLike[];
};

/** A product sells by variant only when it actually has live ones. */
export function hasVariants(product: ProductLike): boolean {
  return product.variants.some((variant) => variant.isActive);
}

/** Live variants in the order the merchant arranged them — S, M, L is not alphabetical. */
export function activeVariants(product: ProductLike): VariantLike[] {
  return product.variants
    .filter((variant) => variant.isActive)
    .sort((a, b) => a.position - b.position || a.value.localeCompare(b.value));
}

/** `null` on a variant means "same as the parent", never "free". */
export function variantPriceKobo(
  product: ProductLike,
  variant: Pick<VariantLike, "priceKobo"> | null | undefined,
): number {
  return variant?.priceKobo ?? product.priceKobo;
}

/**
 * What the catalogue can charge for this product right now — the cheapest live
 * option, because that is the number a grid shows next to "From".
 */
export function displayPriceKobo(product: ProductLike): number {
  const live = activeVariants(product);
  if (live.length === 0) return product.priceKobo;

  return Math.min(...live.map((v) => variantPriceKobo(product, v)));
}

/** True when live variants disagree on price, so the grid should say "From". */
export function hasPriceRange(product: ProductLike): boolean {
  const live = activeVariants(product);
  if (live.length < 2) return false;

  const prices = live.map((v) => variantPriceKobo(product, v));
  return Math.min(...prices) !== Math.max(...prices);
}

/**
 * Total units purchasable.
 *
 * For a product with variants this is the sum of its live variants and NOT
 * `Product.stock`, which is meaningless once variants exist. Selling the last
 * size 42 must never mark size 40 sold out, and vice versa.
 */
export function availableStock(product: ProductLike): number {
  const live = activeVariants(product);
  if (live.length === 0) return product.stock;

  return live.reduce((total, variant) => total + variant.stock, 0);
}

export function isSoldOut(product: ProductLike): boolean {
  return availableStock(product) <= 0;
}

/**
 * The label snapshotted onto an order line: "Size: Small".
 *
 * Stored whole rather than as a pair, so a receipt still reads correctly after
 * the merchant renames the option or retires the variant.
 */
export function variantLabel(optionName: string | null, value: string): string {
  return optionName ? `${optionName}: ${value}` : value;
}
