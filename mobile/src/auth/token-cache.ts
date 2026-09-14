import * as SecureStore from 'expo-secure-store';
import type { TokenCache } from '@clerk/expo';

/**
 * Where Clerk keeps the session on device.
 *
 * `expo-secure-store` is the Keychain on iOS and EncryptedSharedPreferences on
 * Android. Not AsyncStorage: that is plaintext on disk, and this value
 * authenticates every request the app makes on the merchant's behalf.
 *
 * A read failure clears the key rather than throwing. A corrupt entry would
 * otherwise wedge the app at launch with no way out but reinstalling.
 */
export const tokenCache: TokenCache = {
  async getToken(key: string) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      return null;
    }
  },
  async saveToken(key: string, value: string) {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch {
      // Losing the cache means signing in again — recoverable. Crashing is not.
    }
  },
};
