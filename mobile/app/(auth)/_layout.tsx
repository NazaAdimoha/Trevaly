import { Stack } from 'expo-router';

import { color } from '@/theme';

/**
 * Auth group.
 *
 * Exists so `(auth)` is a route in its own right. Without a layout file
 * expo-router flattens the folder to `(auth)/sign-in`, and the root Stack's
 * `<Stack.Screen name="(auth)" />` then points at nothing — which is exactly
 * the "No route named (auth) exists" warning, repeated on every render.
 */
export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.ground },
      }}
    />
  );
}
