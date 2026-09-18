import { useSyncExternalStore } from 'react';

import {
  defaultLayout,
  type PageKey,
  parseLayout,
  type Section,
  sectionId,
  type StorefrontLayout,
} from '@core/storefront/layout';
import { defaultSettings } from '@core/storefront/registry';

import { api, toApiError } from '@/api/client';

/**
 * The design draft the merchant is editing, shared across every Design screen.
 *
 * A module-level store with `useSyncExternalStore`, the same shape as
 * `active-store` and for the same reason: the section list, the settings form
 * and the publish bar are three screens editing ONE layout, and per-screen
 * `useState` would give each of them a private copy that silently diverges the
 * moment the merchant goes back.
 *
 * Edits are local and immediate — a phone on Nigerian mobile data cannot afford
 * a round trip per keystroke — and saved explicitly. `dirty` is what the
 * publish bar reads to know there is something to save.
 *
 * `version` is the optimistic-concurrency token from the API. It is bumped on
 * every successful save and MUST be sent back on the next one: two devices
 * editing one store is rare but real (a merchant on a phone and a laptop), and
 * without it one silently discards the other's work.
 */
type State = {
  slug: string | null;
  layout: StorefrontLayout | null;
  /** The last layout the server acknowledged, for `dirty` and for discarding. */
  saved: StorefrontLayout | null;
  published: StorefrontLayout | null;
  version: number;
  publishedAt: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Set when the server says someone else edited; the app must reload. */
  conflict: boolean;
};

const EMPTY: State = {
  slug: null,
  layout: null,
  saved: null,
  published: null,
  version: 0,
  publishedAt: null,
  loading: false,
  saving: false,
  error: null,
  conflict: false,
};

let state: State = EMPTY;
const listeners = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Must return a stable reference or `useSyncExternalStore` loops forever. */
const getSnapshot = () => state;

export function useDesign() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Whether there is anything to save. Compared by value, not by identity. */
export function isDirty(s: State = state): boolean {
  if (!s.layout || !s.saved) return false;
  return JSON.stringify(s.layout) !== JSON.stringify(s.saved);
}

/** Whether the draft differs from what shoppers currently see. */
export function hasUnpublished(s: State = state): boolean {
  if (!s.layout) return false;
  if (!s.published) return true;
  return JSON.stringify(s.layout) !== JSON.stringify(s.published);
}

const url = (slug: string, rest = '') => `/stores/${slug}/storefront${rest}`;

/**
 * Load the store's design.
 *
 * Deliberately NOT cached through `useQuery`. That hook is built for read-only
 * screens where a stale render is better than a blank one; here a stale layout
 * would carry a stale `version` and the first save would 409 against work the
 * merchant cannot see. The editor asks the server every time it opens.
 */
export async function loadDesign(slug: string): Promise<void> {
  set({ ...EMPTY, slug, loading: true });

  try {
    const { data } = await api.get(url(slug));
    // Parsed through the shared schema rather than trusted: the app may be
    // older than the API and hold sections it cannot render a form for.
    const draft = parseLayout(data.draft).layout;

    set({
      layout: draft,
      saved: draft,
      published: data.published ? parseLayout(data.published).layout : null,
      version: Number(data.version) || 1,
      publishedAt: data.publishedAt ?? null,
      loading: false,
    });
  } catch (err) {
    set({ loading: false, error: toApiError(err).message });
  }
}

/**
 * A deep copy of the draft.
 *
 * `structuredClone` is NOT in Hermes, which is what React Native runs — reaching
 * for it here would have crashed on the merchant's first edit rather than at
 * build time. A JSON round trip is exact for this value in any case: a layout
 * is plain JSON by definition, since that is how it is stored and sent.
 */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Apply an edit to the in-memory draft, and queue a save. */
export function edit(change: (layout: StorefrontLayout) => StorefrontLayout): void {
  if (!state.layout) return;
  set({ layout: change(clone(state.layout)), error: null });
  scheduleSave();
}

/**
 * Save shortly after the merchant stops editing.
 *
 * Not on every change — that is a request per keystroke on mobile data — and
 * not only on Publish, because a phone call arriving mid-edit must not cost an
 * afternoon's work.
 *
 * Deliberately a MODULE-level timer rather than an effect in a screen. The
 * Design screens are a stack, so index, the section list and the settings form
 * are all mounted at once; an effect would give each of them its own timer and
 * fire three saves, of which the second and third would carry a version the
 * first had already consumed and come back 409. One timer, owned by the thing
 * being saved.
 */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
const SAVE_DELAY = 2000;

function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void saveDraft();
  }, SAVE_DELAY);
}

export async function saveDraft(): Promise<boolean> {
  const { slug, layout, version } = state;
  if (!slug || !layout) return false;

  // A save already in flight owns the current version. Queue behind it rather
  // than sending a second request with a token that is about to be spent.
  if (state.saving) {
    scheduleSave();
    return false;
  }
  if (!isDirty()) return true;

  set({ saving: true, error: null });
  try {
    const { data } = await api.put(url(slug, '/draft'), { layout, version });
    set({
      saved: parseLayout(data.draft).layout,
      version: Number(data.version) || version + 1,
      saving: false,
    });
    return true;
  } catch (err) {
    const error = toApiError(err);
    // 409 means another device moved the store on. The merchant's own edits are
    // still on screen; the app offers a reload rather than choosing a winner.
    set({ saving: false, error: error.message, conflict: error.status === 409 });
    return false;
  }
}

/** Save first, then publish — publishing what is on screen, not what was saved. */
export async function publish(): Promise<boolean> {
  if (isDirty() && !(await saveDraft())) return false;

  const { slug, version } = state;
  if (!slug) return false;

  set({ saving: true, error: null });
  try {
    const { data } = await api.post(url(slug, '/publish'), { version });
    set({
      published: parseLayout(data.published).layout,
      version: Number(data.version) || version + 1,
      publishedAt: data.publishedAt ?? null,
      saving: false,
    });
    return true;
  } catch (err) {
    const error = toApiError(err);
    set({ saving: false, error: error.message, conflict: error.status === 409 });
    return false;
  }
}

/** Throw the draft away and go back to what shoppers are seeing. */
export async function revert(): Promise<boolean> {
  const { slug } = state;
  if (!slug) return false;

  set({ saving: true, error: null });
  try {
    const { data } = await api.post(url(slug, '/revert'), {});
    const draft = parseLayout(data.draft).layout;
    set({ layout: draft, saved: draft, version: Number(data.version) || state.version, saving: false });
    return true;
  } catch (err) {
    set({ saving: false, error: toApiError(err).message });
    return false;
  }
}

// ── Section operations ──────────────────────────────────────────────────────
//
// All of them go through `edit`, so a screen never mutates the layout itself
// and every change lands in one place.

export function addSection(page: PageKey, type: string): string {
  const id = sectionId(type);
  edit((layout) => {
    layout.pages[page] = [
      ...layout.pages[page],
      { id, type, visible: true, settings: defaultSettings(type) },
    ];
    return layout;
  });
  return id;
}

export function removeSection(page: PageKey, id: string): void {
  edit((layout) => {
    layout.pages[page] = layout.pages[page].filter((s) => s.id !== id);
    return layout;
  });
}

export function toggleSection(page: PageKey, id: string): void {
  edit((layout) => {
    layout.pages[page] = layout.pages[page].map((s) =>
      s.id === id ? { ...s, visible: !s.visible } : s,
    );
    return layout;
  });
}

/**
 * Move a section one place up or down.
 *
 * Buttons rather than drag-and-drop, and not as a stopgap. Long-press dragging
 * inside a scrolling list is the single most failure-prone interaction on a
 * phone — it fights the scroll, it needs a gesture handler, and it is close to
 * unusable for anyone with a motor impairment. Two arrows are unambiguous,
 * reachable one-handed, and work with a screen reader.
 */
export function moveSection(page: PageKey, id: string, direction: -1 | 1): void {
  edit((layout) => {
    const list = layout.pages[page];
    const from = list.findIndex((s) => s.id === id);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= list.length) return layout;

    const next = [...list];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    layout.pages[page] = next;
    return layout;
  });
}

export function updateSettings(
  page: PageKey,
  id: string,
  patch: Record<string, unknown>,
): void {
  edit((layout) => {
    layout.pages[page] = layout.pages[page].map((s) =>
      s.id === id ? { ...s, settings: { ...s.settings, ...patch } } : s,
    );
    return layout;
  });
}

export function findSection(page: PageKey, id: string): Section | null {
  return state.layout?.pages[page].find((s) => s.id === id) ?? null;
}

/** Appearance lives outside `pages` — preset and token overrides. */
export function setPreset(preset: StorefrontLayout['preset']): void {
  edit((layout) => ({ ...layout, preset }));
}

export function setTokens(patch: Partial<StorefrontLayout['tokens']>): void {
  edit((layout) => ({ ...layout, tokens: { ...layout.tokens, ...patch } }));
}

/** Chrome: the announcement bar, header, footer and the phone tab bar. */
export function setChrome<K extends 'announcement' | 'header' | 'footer' | 'mobileBar'>(
  key: K,
  patch: Partial<StorefrontLayout[K]>,
): void {
  edit((layout) => ({ ...layout, [key]: { ...layout[key], ...patch } }));
}

/** A fresh, unsaved layout for a store that has never been designed. */
export function seedLayout(): StorefrontLayout {
  return defaultLayout();
}
