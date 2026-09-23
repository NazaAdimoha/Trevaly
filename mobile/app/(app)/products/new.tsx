import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api, toApiError } from '@/api/client';
import { useQuery } from '@/api/hooks';
import { categoryListSchema } from '@/api/schemas';
import { uploadProductImage } from '@/api/upload';
import {
  emptyDraft,
  type ProductDraft,
  ProductFields,
  toPayload,
} from '@/products/form';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import { Button, Card } from '@/ui';

/**
 * Add a product from the thing in your hand.
 *
 * This is the screen the app exists for: a merchant photographs a dress and it
 * is on their storefront a minute later, without a laptop.
 *
 * It used to ask for a name, a price and a count, and send the merchant to the
 * web dashboard for a description, a category or sizes. That was the wrong
 * trade: most of these merchants do not have a laptop, so "editable on the web
 * afterwards" meant "never set". The fields live in `@/products/form`, shared
 * with the edit screen so the two cannot drift.
 *
 * The price is typed in naira and converted with the shared `toMinor()` — the
 * same function the web form uses. Money is integer kobo everywhere; a rounding
 * difference between the two clients would be a mispriced product.
 */
export default function NewProductScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();

  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useQuery(
    slug ? `/stores/${slug}/categories` : null,
    categoryListSchema,
    [slug],
  );

  const pick = async (from: 'camera' | 'library') => {
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
          });

    if (result.canceled || !result.assets[0]) return;
    setPicked(result.assets[0]);
    setImageUri(result.assets[0].uri);
  };

  const submit = async () => {
    if (!slug) return;
    setError(null);

    // Validated before the upload, so a form error never costs a merchant an
    // image upload over mobile data first.
    const built = toPayload(draft, []);
    if ('error' in built) return setError(built.error);

    setBusy(true);
    try {
      // Image first: if the upload fails the merchant still has the form, with
      // everything they typed in it.
      const imageUrls: string[] = [];
      if (picked) {
        imageUrls.push(await uploadProductImage(slug, picked));
      }

      await api.post(`/stores/${slug}/products`, { ...built.payload, imageUrls });
      router.back();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Card style={styles.photoCard}>
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.preview} />
          ) : (
            <View style={[styles.preview, styles.previewEmpty]}>
              <Text style={styles.previewHint}>No photo yet</Text>
            </View>
          )}
          <View style={styles.photoButtons}>
            <Pressable
              style={styles.photoButton}
              onPress={() => void pick('camera')}
              accessibilityRole="button"
            >
              <Text style={styles.photoButtonText}>Take photo</Text>
            </Pressable>
            <Pressable
              style={styles.photoButton}
              onPress={() => void pick('library')}
              accessibilityRole="button"
            >
              <Text style={styles.photoButtonText}>Choose photo</Text>
            </Pressable>
          </View>
        </Card>

        <ProductFields
          draft={draft}
          onChange={setDraft}
          categories={categories.data?.items ?? []}
        />

        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Button
          label={picked ? 'Upload and publish' : 'Publish'}
          onPress={() => void submit()}
          busy={busy}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.ground },
  page: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  photoCard: { gap: space.md },
  preview: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: color.sunk },
  previewEmpty: { alignItems: 'center', justifyContent: 'center' },
  previewHint: { ...text.small, color: color.muted },
  photoButtons: { flexDirection: 'row', gap: space.sm },
  photoButton: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  photoButtonText: { ...text.small, color: color.ink, fontFamily: font.medium },
  error: { ...text.small, color: color.danger },
});
