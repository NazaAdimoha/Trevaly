import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

const KEY = 'merchant.activeStoreSlug';

/**
 * Which store the app is acting for — shared across every screen.
 *
 * The first version kept this in `useState` inside the hook, which meant every
 * screen got its OWN copy: Today would pick a store and write it to storage,
 * and Products, already mounted with `slug === null`, never heard about it and
 * rendered "No products yet" forever. That is the bug behind the empty screens.
 *
 * A module-level store with `useSyncExternalStore` fixes it with no dependency:
 * one value, every subscriber re-renders, and the snapshot is synchronous so a
 * screen mounted after the choice reads it immediately.
 */

type State = { slug: string | null; ready: boolean };

let state: State = { slug: null, ready: false };
const listeners = new Set<() => void>();

function emit(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Must return a stable reference or `useSyncExternalStore` loops forever. */
const getSnapshot = () => state;

// Kicked off once at module load rather than in an effect, so the value is
// already settling before the first screen renders.
let hydrating: Promise<void> | null = null;

function hydrate() {
  hydrating ??= AsyncStorage.getItem(KEY)
    .then((stored) => emit({ slug: stored, ready: true }))
    .catch(() => emit({ slug: null, ready: true }));
  return hydrating;
}

export function useActiveStore() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (!snapshot.ready) void hydrate();

  const choose = useCallback(async (next: string) => {
    emit({ slug: next, ready: true });
    await AsyncStorage.setItem(KEY, next);
  }, []);

  const clear = useCallback(async () => {
    emit({ slug: null, ready: true });
    await AsyncStorage.removeItem(KEY);
  }, []);

  return { slug: snapshot.slug, ready: snapshot.ready, choose, clear };
}
