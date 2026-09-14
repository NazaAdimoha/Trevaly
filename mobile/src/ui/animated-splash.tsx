import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { color, font } from '@/theme';

/**
 * The splash you actually see.
 *
 * A native splash cannot animate — it is a static image the OS draws before any
 * JavaScript exists. So there are two, and the whole trick is that you never
 * notice the join:
 *
 *   1. The OS draws `assets/splash-icon.png` on forest ground the instant the
 *      app is tapped.
 *   2. React mounts and renders THIS, deliberately identical at frame zero —
 *      same ground, same mark, same size, same position.
 *   3. Only then does the native splash hide. Because the two frames match,
 *      there is nothing to see: no white flash, no jump.
 *   4. This one animates, then lifts away to reveal the app.
 *
 * Getting step 3 backwards — hiding the native splash before this is on screen
 * — is what produces the white flash almost every RN app has.
 *
 * Everything runs on the UI thread via Reanimated worklets, so the animation
 * holds its frame rate while JS is still busy booting Clerk and hydrating the
 * store — which is exactly when a JS-driven animation would stutter.
 */

/** Matches `imageWidth` in the expo-splash-screen plugin config. */
const MARK_SIZE = 180;

/** The white tile is 60% of that image; the green square 51.7% of the tile. */
const TILE = MARK_SIZE * 0.6;
const INNER = TILE * 0.517;

export default function AnimatedSplash({
  onFinish,
}: {
  /** Called once the overlay has fully faded. Unmount it here. */
  onFinish: () => void;
}) {
  // Frame zero must equal the native splash exactly: mark at full size, fully
  // opaque, nothing else visible.
  const markScale = useSharedValue(1);
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const wordmarkY = useSharedValue(12);
  const wordmarkOpacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);
  const overlayScale = useSharedValue(1);

  useEffect(() => {
    // A small dip before the rise. The compression is what makes the spring
    // read as weight rather than as a thing that simply got bigger.
    markScale.value = withSequence(
      withTiming(0.88, { duration: 220, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 9, stiffness: 140, mass: 0.9 }),
    );

    // One gold ring pushed out by that spring. Scale and fade are separate
    // curves on purpose: linear-out scale with an eased fade reads as energy
    // dissipating, whereas fading in lockstep looks like a loading spinner.
    ringOpacity.value = withDelay(
      200,
      withSequence(
        withTiming(0.55, { duration: 180 }),
        withTiming(0, { duration: 620, easing: Easing.out(Easing.quad) }),
      ),
    );
    ringScale.value = withDelay(
      200,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) }),
    );

    wordmarkOpacity.value = withDelay(420, withTiming(1, { duration: 380 }));
    wordmarkY.value = withDelay(
      420,
      withSpring(0, { damping: 14, stiffness: 120 }),
    );

    // The exit. Scaling up slightly while fading reads as the splash lifting
    // toward the viewer and away, rather than a dissolve — it hands off to the
    // app instead of just stopping.
    overlayScale.value = withDelay(
      1180,
      withTiming(1.08, { duration: 520, easing: Easing.in(Easing.cubic) }),
    );
    overlayOpacity.value = withDelay(
      1180,
      withTiming(0, { duration: 520, easing: Easing.in(Easing.quad) }, (done) => {
        // `runOnJS` because `onFinish` is React state and this callback fires
        // on the UI thread.
        if (done) runOnJS(onFinish)();
      }),
    );
  }, [
    markScale,
    ringScale,
    ringOpacity,
    wordmarkY,
    wordmarkOpacity,
    overlayOpacity,
    overlayScale,
  ]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    transform: [{ scale: overlayScale.value }],
  }));

  const markStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: markScale.value },
      // A degree and a half of counter-rotation as it settles. Enough to feel
      // hand-placed; not enough to notice as rotation.
      { rotate: `${interpolate(markScale.value, [0.88, 1], [-1.5, 0])}deg` },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: interpolate(ringScale.value, [0, 1], [0.55, 2.4]) }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkOpacity.value,
    transform: [{ translateY: wordmarkY.value }],
  }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, overlayStyle]}
      pointerEvents="none"
    >
      <View style={styles.centre}>
        {/* Ring and mark share a wrapper so they share a centre. Positioned
            against the screen instead, the ring drifts off-axis — the wordmark
            below shifts the whole group upward. */}
        <View style={styles.markWrap}>
          <Animated.View style={[styles.ring, ringStyle]} />

          <Animated.View style={markStyle}>
          <LinearGradient
            colors={['#FFFFFF', '#EDEBE4']}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.mark}
          >
            <LinearGradient
              colors={[color.primary400, color.primary700]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
                style={styles.markInner}
              />
            </LinearGradient>
          </Animated.View>
        </View>

        <Animated.View style={wordmarkStyle}>
          <Text style={styles.wordmark}>Merchant</Text>
          <Text style={styles.tagline}>Take the order. Get paid.</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Must equal the plugin's `backgroundColor`, or the handoff shows a seam.
  root: { backgroundColor: color.forest900, zIndex: 100 },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  markWrap: { alignItems: 'center', justifyContent: 'center' },

  ring: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    borderRadius: TILE / 2,
    borderWidth: 2,
    borderColor: '#FFC53D',
  },

  // These four numbers are derived from `assets/splash-icon.png`, not chosen.
  // The animated splash has to be pixel-identical to the native one at frame
  // zero or the handoff visibly jumps — the tile is 60% of the 180pt image, its
  // corner radius 14.2% of its own width, the inner square 51.7% of the tile.
  mark: {
    width: TILE,
    height: TILE,
    borderRadius: TILE * 0.142,
    alignItems: 'center',
    justifyContent: 'center',
    // The mark is the only lit object on a dark ground, so it carries a real
    // shadow — without one it reads as a sticker on the screen.
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  markInner: {
    width: INNER,
    height: INNER,
    borderRadius: INNER * 0.145,
  },

  wordmark: {
    fontFamily: font.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 28,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 13.5,
    color: color.primary200,
    textAlign: 'center',
    marginTop: 6,
  },
});
