import { ClerkLoaded, ClerkProvider, useAuth } from '@clerk/expo';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { tokenCache } from '@/auth/token-cache';
import AnimatedSplash from '@/ui/animated-splash';
import { color } from '@/theme';
import { Loading } from '@/ui';

/**
 * Hold the native splash until the app can actually paint.
 *
 * Without this the splash disappears the moment React mounts and the merchant
 * sees an unstyled flash — system-font text at the wrong size, jumping into
 * place once Poppins loads. `catch` because this throws in contexts where the
 * splash was never shown (a fast refresh), and a crash on a cosmetic call is
 * absurd.
 */
void SplashScreen.preventAutoHideAsync().catch(() => {});

/**
 * Root of the merchant app.
 *
 * `ClerkLoaded` gates everything below it: rendering a screen before Clerk has
 * restored the session flashes the sign-in page at an already-signed-in
 * merchant on every cold start, which reads as being logged out.
 */
export default function RootLayout() {
  const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

  const [splashDone, setSplashDone] = useState(false);

  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // A font that fails to download must not brick the app — every `fontFamily`
  // falls back to the system face and the merchant can still take orders.
  const fontsSettled = fontsLoaded || fontError !== null;

  /**
   * Hide the NATIVE splash only once our own is laid out.
   *
   * Order matters and is the whole reason there is no white flash here: the
   * animated splash renders identical to the native one at frame zero, and only
   * after it is on screen do we drop the native layer underneath it. Hiding
   * first — the obvious way round — shows a white frame while React paints.
   */
  const onLayout = useCallback(() => {
    if (fontsSettled) void SplashScreen.hideAsync().catch(() => {});
  }, [fontsSettled]);

  if (!publishableKey) {
    throw new Error(
      'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is missing. Copy it from the web app’s .env.',
    );
  }

  // Returning null keeps the native splash on screen rather than swapping it
  // for a blank white view.
  if (!fontsSettled) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
        {/* Light while the splash covers the screen (it is dark), dark once the
            app shows through. Set here rather than inside the splash so there is
            no moment where the two disagree. */}
        <StatusBar style={splashDone ? 'dark' : 'light'} />
        <ClerkLoaded>
          <AuthGate />
        </ClerkLoaded>
      </ClerkProvider>

      {/* Mounted OVER the app, not instead of it: Clerk restores the session and
          the store hydrates behind the animation, so the splash is spending time
          the app needed anyway rather than adding a second and a half to launch.
          Unmounted entirely once faded — an invisible overlay still composites
          every frame. */}
      {!splashDone ? (
        <AnimatedSplash onFinish={() => setSplashDone(true)} />
      ) : null}
    </View>
  );
}

/**
 * Sends the merchant to the right half of the app.
 *
 * Redirecting in an effect rather than rendering a `<Redirect>` because the
 * router is not ready during the first render pass — navigating then is a
 * no-op that leaves the app on a blank screen.
 */
function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isSignedIn && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isSignedIn && inAuthGroup) {
      router.replace('/(app)');
    }
  }, [isLoaded, isSignedIn, segments, router]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: color.ground }}>
        <Loading />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.ground } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}
