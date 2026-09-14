import { createContext, type ReactNode, useContext } from 'react';

import { type AppConfigResponse, appConfigResponseSchema } from '@core/api/contracts';

import { useQuery } from './hooks';

/**
 * Server-driven app configuration, fetched once and shared.
 *
 * Carries the minimum-version gate, feature flags, and the Cloudinary cloud
 * name the app needs to render product images from stored public IDs. Fetched
 * in one place rather than per screen so a merchant on a slow connection pays
 * for it once.
 */
const ConfigContext = createContext<AppConfigResponse | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery('/app/config', appConfigResponseSchema);
  return <ConfigContext.Provider value={data}>{children}</ConfigContext.Provider>;
}

export function useAppConfig() {
  return useContext(ConfigContext);
}

/**
 * A delivery URL for a Cloudinary public ID.
 *
 * `f_auto,q_auto` is what keeps a merchant's 4MB phone photo from being sent to
 * a phone in full — the same transformation the storefront applies.
 */
export function imageUrl(
  cloudName: string | null | undefined,
  publicId: string | undefined,
  width = 200,
): string | null {
  if (!cloudName || !publicId) return null;
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,g_auto,w_${width},h_${width}/f_auto/q_auto/${publicId}`;
}
