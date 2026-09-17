import { create } from 'zustand';

/**
 * Which storefront overlay is open.
 *
 * Deliberately a store rather than context: "add to cart" lives deep inside a
 * product page and has to open the drawer that lives in the shell, and passing
 * a callback down through the section renderer to get there would put a client
 * boundary around markup that is currently server-rendered.
 *
 * One at a time, by construction — opening any panel closes the others. Two
 * stacked slide-overs have no sensible answer for what Escape should close.
 */
export type Overlay = 'cart' | 'search' | 'menu' | null;

type UiState = {
  overlay: Overlay;
  open: (overlay: Exclude<Overlay, null>) => void;
  close: () => void;
  toggle: (overlay: Exclude<Overlay, null>) => void;
};

export const useStorefrontUi = create<UiState>((set) => ({
  overlay: null,
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
  toggle: (overlay) => set((state) => ({ overlay: state.overlay === overlay ? null : overlay })),
}));

/** Subscribe to one panel without re-rendering when a different one opens. */
export const useIsOpen = (overlay: Exclude<Overlay, null>) =>
  useStorefrontUi((state) => state.overlay === overlay);
