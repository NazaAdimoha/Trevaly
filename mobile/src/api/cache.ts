import AsyncStorage from '@react-native-async-storage/async-storage';
import type { z } from 'zod';

/**
 * Last-known-good response cache.
 *
 * Nigerian mobile data is patchy and the merchant is often standing in a market
 * with one bar. Without this, a dropped request blanks the screen and the app is
 * useless exactly when it is most needed; with it, the merchant still sees this
 * morning's orders and is told how old they are.
 *
 * Two rules make this safe rather than merely convenient:
 *
 *   1. CACHED DATA IS REVALIDATED, NOT TRUSTED. Every read is re-parsed with the
 *      same Zod schema the network path uses. A cache written by an older build
 *      whose shape has since changed is dropped, not rendered — otherwise a
 *      schema change ships a crash to anyone with a warm cache.
 *
 *   2. THE CACHE IS CLEARED ON SIGN-OUT. Keys are namespaced but not
 *      user-scoped, and a merchant handing a phone to staff who sign in as
 *      themselves must not see the previous session's orders and revenue.
 *      `clearCache()` is called from the sign-out path for exactly this reason.
 */

/** Bump to invalidate every cached entry at once after a breaking change. */
const PREFIX = 'cache:v1:';

const keyFor = (path: string) => `${PREFIX}${path}`;

type Envelope = { storedAt: number; value: unknown };

export type CacheHit<T> = { value: T; storedAt: number };

/**
 * Read and revalidate. Returns null on a miss, a parse failure, or any storage
 * error — a cache is an optimisation, so every failure mode is a miss rather
 * than something the caller has to handle.
 */
export async function readCache<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<CacheHit<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(path));
    if (!raw) return null;

    const envelope = JSON.parse(raw) as Envelope;
    const parsed = schema.safeParse(envelope.value);
    if (!parsed.success) {
      // Shape has moved on since this was written. Drop it so we do not keep
      // paying the parse cost on every mount.
      void AsyncStorage.removeItem(keyFor(path));
      return null;
    }

    return { value: parsed.data, storedAt: envelope.storedAt };
  } catch {
    return null;
  }
}

/** Store a fresh response. Failures are swallowed: never break a good fetch. */
export async function writeCache(path: string, value: unknown): Promise<void> {
  try {
    const envelope: Envelope = { storedAt: Date.now(), value };
    await AsyncStorage.setItem(keyFor(path), JSON.stringify(envelope));
  } catch {
    // Storage full or unavailable — the app works, it is just not offline-ready.
  }
}

/**
 * Drop every cached response. Call on sign-out; see rule 2 above.
 *
 * Only our own prefix is touched, so the Clerk token cache and anything else
 * sharing AsyncStorage survive.
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter((k) => k.startsWith(PREFIX));
    if (ours.length) await AsyncStorage.multiRemove(ours);
  } catch {
    // Nothing actionable; the next sign-in re-validates against its own schemas.
  }
}
