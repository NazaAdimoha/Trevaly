import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { imageUrl } from '@/api/config';
import { uploadProductImage } from '@/api/upload';
import { color, font, radius, space, text } from '@/theme';

/** The write schema's ceiling. Shown, not discovered by a rejected save. */
const MAX_PHOTOS = 8;

/**
 * Add, remove and reorder a product's photos.
 *
 * The edit screen used to show "3 photos" as a line of text — a merchant could
 * see how many they had and change none of them. Photos are the whole product
 * on a storefront, and the one thing a merchant reshoots.
 *
 * Order is meaning, not preference: the FIRST image is the cover, used in the
 * grid, the cart, the order summary and the share card. So the list is
 * reorderable, and the cover says so rather than leaving a merchant to work out
 * why one of their photos is the one everybody sees.
 */
export function ProductPhotos({
  publicIds,
  onChange,
  storeSlug,
  cloudName,
}: {
  publicIds: string[];
  onChange: (next: string[]) => void;
  storeSlug: string;
  cloudName: string | null;
}) {
  const [busy, setBusy] = useState(false);
  const full = publicIds.length >= MAX_PHOTOS;

  const add = async (from: 'camera' | 'library') => {
    const permission =
      from === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(
        'Permission needed',
        from === 'camera'
          ? 'Allow camera access to photograph products.'
          : 'Allow photo access to choose a picture.',
      );
      return;
    }

    const result =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.8,
            // Several at once, capped at what is left. A merchant who shot a
            // dress from four angles should not repeat this four times.
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - publicIds.length,
          });

    if (result.canceled || result.assets.length === 0) return;

    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const asset of result.assets.slice(0, MAX_PHOTOS - publicIds.length)) {
        // Sequential, not Promise.all: these are phone photos on mobile data,
        // and four parallel uploads on one bar of signal is how all four fail.
        uploaded.push(await uploadProductImage(storeSlug, asset));
      }
      onChange([...publicIds, ...uploaded]);
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (index: number) =>
    // Dropped from the product, not deleted from Cloudinary: an id can appear
    // on a past order's line, and destroying the asset would blank a receipt.
    onChange(publicIds.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= publicIds.length) return;
    const next = [...publicIds];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.label}>Photos</Text>
        <Text style={styles.hint}>
          {publicIds.length} of {MAX_PHOTOS}
        </Text>
      </View>

      {publicIds.length === 0 ? (
        <Text style={styles.hint}>
          No photos yet. A product without one is the hardest thing to sell.
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {publicIds.map((publicId, index) => (
            <View key={publicId} style={styles.tile}>
              <Image
                source={{ uri: imageUrl(cloudName, publicId, 300) ?? undefined }}
                style={styles.photo}
              />

              {index === 0 ? (
                <View style={styles.coverTag}>
                  <Text style={styles.coverTagText}>Cover</Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => remove(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
                hitSlop={6}
                style={styles.removeDot}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>

              <View style={styles.tileTools}>
                <Pressable
                  onPress={() => move(index, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${index + 1} earlier`}
                  hitSlop={6}
                  style={styles.tool}
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={index === 0 ? color.line : color.body}
                  />
                </Pressable>
                <Pressable
                  onPress={() => move(index, 1)}
                  disabled={index === publicIds.length - 1}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${index + 1} later`}
                  hitSlop={6}
                  style={styles.tool}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={index === publicIds.length - 1 ? color.line : color.body}
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={color.primary700} />
          <Text style={styles.hint}>Uploading…</Text>
        </View>
      ) : (
        <View style={styles.buttons}>
          <Pressable
            onPress={() => void add('camera')}
            disabled={full}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              full && styles.buttonOff,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="camera-outline" size={16} color={full ? color.muted : color.ink} />
            <Text style={[styles.buttonText, full && { color: color.muted }]}>Take photo</Text>
          </Pressable>
          <Pressable
            onPress={() => void add('library')}
            disabled={full}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              full && styles.buttonOff,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="images-outline" size={16} color={full ? color.muted : color.ink} />
            <Text style={[styles.buttonText, full && { color: color.muted }]}>Choose photos</Text>
          </Pressable>
        </View>
      )}

      {full ? (
        <Text style={styles.hint}>
          That is the most a product can have. Remove one to add another.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { ...text.small, color: color.ink, fontFamily: font.medium },
  hint: { ...text.small, color: color.muted },

  tile: { marginRight: space.sm },
  photo: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: color.sunk,
  },
  coverTag: {
    position: 'absolute',
    bottom: 34,
    left: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: color.forest900,
  },
  coverTagText: { ...text.small, fontSize: 11, color: '#FFFFFF' },
  removeDot: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: color.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileTools: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.xs },
  tool: { padding: space.xs },

  busy: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  buttons: { flexDirection: 'row', gap: space.sm },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  buttonOff: { backgroundColor: color.sunk },
  buttonText: { ...text.small, color: color.ink, fontFamily: font.medium },
  pressed: { opacity: 0.85 },
});
