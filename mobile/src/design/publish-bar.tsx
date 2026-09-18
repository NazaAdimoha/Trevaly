import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  hasUnpublished,
  isDirty,
  publish,
  revert,
  useDesign,
} from '@/store/design';
import { color, radius, space, text } from '@/theme';
import { Button } from '@/ui';

/**
 * The bar pinned to the bottom of every Design screen.
 *
 * It lives in `src/`, NOT in `app/design/`. expo-router turns every file under
 * `app/` into a route, so a component parked beside the screens it serves
 * becomes a navigable blank page — `/design/publish-bar` really did appear in
 * the generated route types before this was moved.
 *
 * Draft and published are two different things and the merchant has to be able
 * to tell which one shoppers are looking at — without that, every edit feels
 * live and nobody dares experiment. This says which state the shop is in, and
 * it is the only way to change it.
 *
 * It is a component rather than part of the stack's layout because it needs to
 * sit ABOVE the scroll content on each screen, not between the screens.
 */
export function PublishBar() {
  const design = useDesign();
  const dirty = isDirty(design);
  const unpublished = hasUnpublished(design);

  if (!design.layout) return null;

  const onPublish = async () => {
    if (await publish()) {
      Alert.alert('Published', 'Your storefront has been updated.');
    }
  };

  const onRevert = () => {
    Alert.alert(
      'Discard changes?',
      'Your draft goes back to what shoppers are seeing now. This cannot be undone.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void revert() },
      ],
    );
  };

  return (
    <View style={styles.bar}>
      {design.error ? (
        <View style={styles.error}>
          <Ionicons name='alert-circle' size={16} color={color.danger} />
          <Text style={styles.errorText}>
            {design.conflict
              ? 'Someone else changed this storefront. Close Design and open it again to get their version.'
              : design.error}
          </Text>
        </View>
      ) : null}

      <View style={styles.row}>
        <View style={styles.status}>
          <View
            style={[
              styles.dot,
              { backgroundColor: unpublished ? color.warning : color.success },
            ]}
          />
          <Text style={styles.statusText}>
            {!design.published
              ? 'Not published yet'
              : unpublished
                ? dirty
                  ? 'Unsaved changes'
                  : 'Saved, not published'
                : 'Live'}
          </Text>
        </View>

        {/* Only offered once something HAS been published. `revert` restores
            the published layout, so on a store that has never published there
            is nothing to restore — the API answers 409, and a button that can
            only fail is worse than no button. */}
        {unpublished && design.published ? (
          <Pressable
            onPress={onRevert}
            accessibilityRole='button'
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.discard}>Discard</Text>
          </Pressable>
        ) : null}
      </View>

      <Button
        label={unpublished ? 'Publish' : 'Published'}
        onPress={() => void onPublish()}
        busy={design.saving}
        disabled={!unpublished}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xl,
    gap: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: radius.pill },
  statusText: { ...text.small, color: color.body },
  discard: { ...text.small, color: color.danger },

  error: {
    flexDirection: 'row',
    gap: space.sm,
    backgroundColor: color.dangerBg,
    borderRadius: radius.md,
    padding: space.md,
  },
  errorText: { ...text.small, color: color.danger, flex: 1 },

  pressed: { opacity: 0.7 },
});
