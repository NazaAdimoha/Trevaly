import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Storefront cart.
 *
 * Persisted to localStorage so it survives a refresh — never to a cookie (it
 * would be sent on every request) and never to the database before checkout is
 * actually submitted.
 *
 * `unitPriceKobo` here is for display only. Every price is recomputed from the
 * database in `/api/checkout`; nothing the browser stores is ever trusted.
 *
 * The store is namespaced per tenant so two storefronts open in the same
 * browser cannot contaminate each other's carts.
 */

export type CartItem = {
  productId: string;
  /** Null for a product bought as-is. Part of the line's identity. */
  variantId: string | null;
  /** "Size: Small", snapshotted for display. Null when there is no variant. */
  variantLabel: string | null;
  name: string;
  slug: string;
  imageUrl: string | null;
  unitPriceKobo: number;
  quantity: number;
  maxStock: number;
};

/**
 * A line is a product AND a variant. One Small and one Large of the same dress
 * are two lines, not one line of two — every mutation below keys on this rather
 * than on `productId`.
 */
export function lineKey(item: {
  productId: string;
  variantId: string | null;
}): string {
  return `${item.productId}::${item.variantId ?? ''}`;
}

type CartState = {
  tenantSlug: string | null;
  items: CartItem[];
  setTenant: (slug: string) => void;
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  subtotalKobo: () => number;
  itemCount: () => number;
};

const MAX_QUANTITY = 99;

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      tenantSlug: null,
      items: [],

      // Switching storefronts empties the cart rather than merging it.
      setTenant: (slug) =>
        set((state) =>
          state.tenantSlug === slug ? state : { tenantSlug: slug, items: [] },
        ),

      addItem: (item, quantity = 1) =>
        set((state) => {
          const key = lineKey(item);
          const existing = state.items.find((i) => lineKey(i) === key);

          if (!existing) {
            return {
              items: [
                ...state.items,
                { ...item, quantity: clamp(quantity, item.maxStock) },
              ],
            };
          }

          return {
            items: state.items.map((i) =>
              lineKey(i) === key
                ? { ...i, quantity: clamp(i.quantity + quantity, i.maxStock) }
                : i,
            ),
          };
        }),

      removeItem: (key) =>
        set((state) => ({
          items: state.items.filter((i) => lineKey(i) !== key),
        })),

      updateQuantity: (key, quantity) =>
        set((state) => ({
          items:
            quantity <= 0
              ? state.items.filter((i) => lineKey(i) !== key)
              : state.items.map((i) =>
                  lineKey(i) === key
                    ? { ...i, quantity: clamp(quantity, i.maxStock) }
                    : i,
                ),
        })),

      clear: () => set({ items: [] }),

      subtotalKobo: () =>
        get().items.reduce(
          (total, item) => total + item.unitPriceKobo * item.quantity,
          0,
        ),

      itemCount: () =>
        get().items.reduce((count, item) => count + item.quantity, 0),
    }),
    {
      name: 'storefront-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tenantSlug: state.tenantSlug,
        items: state.items,
      }),

      // Bumped when variants were added. A cart persisted before then has items
      // with no `variantId`, and `lineKey` would read `undefined` on them —
      // producing a key that matches nothing, so the shopper could not remove
      // or re-add their own items. Backfilling is enough; there is no need to
      // empty a cart someone assembled.
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as {
          tenantSlug: string | null;
          items: CartItem[];
        };
        if (version >= 1) return state;

        return {
          ...state,
          items: (state.items ?? []).map((item) => ({
            ...item,
            variantId: null,
            variantLabel: null,
          })),
        };
      },
    },
  ),
);

function clamp(quantity: number, maxStock: number): number {
  return Math.max(1, Math.min(quantity, Math.min(maxStock, MAX_QUANTITY)));
}
