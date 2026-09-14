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

import { toMinor } from '@core/money';

import { api, toApiError } from '@/api/client';
import { uploadProductImage } from '@/api/upload';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import { Button, Card, formatNaira } from '@/ui';

/**
 * Add a product from the thing in your hand.
 *
 * This is the screen the app exists for: a merchant photographs a dress and it
 * is on their storefront a minute later, without a laptop. Everything else is
 * subordinate to that — the form asks for a name, a price and a stock count and
 * nothing more. Categories, options, SKUs and descriptions are all editable on
 * the web afterwards.
 *
 * The price is typed in naira and converted with the shared `toMinor()` — the
 * same function the web form uses. Money is integer kobo everywhere; a rounding
 * difference between the two clients would be a mispriced product.
 */
export default function NewProductScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('1');
  const [live, setLive] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [picked, setPicked] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const nairaPreview = (() => {
    const value = Number(price.replace(/[^\d.]/g, ''));
    return Number.isFinite(value) && value > 0 ? formatNaira(toMinor(value)) : null;
  })();

  const submit = async () => {
    if (!slug) return;
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) return setError('Give the product a name.');

    const priceKobo = toMinor(Number(price.replace(/[^\d.]/g, '')));
    if (!Number.isFinite(priceKobo) || priceKobo < 1) {
      return setError('Enter a price greater than zero.');
    }

    const stockCount = Number(stock.replace(/[^\d]/g, '') || '0');
    setBusy(true);

    try {
      // Image first: if the upload fails the merchant still has the form, with
      // everything they typed in it.
      const imageUrls: string[] = [];
      if (picked) {
        imageUrls.push(await uploadProductImage(slug, picked));
      }

      await api.post(`/stores/${slug}/products`, {
        name: trimmed,
        slug: slugify(trimmed),
        description: '',
        sku: '',
        priceKobo,
        stock: stockCount,
        imageUrls,
        isActive: live,
        optionName: '',
        variants: [],
      });

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

        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ankara midi dress"
            placeholderTextColor={color.muted}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Price</Text>
          <TextInput
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            placeholder="25000"
            placeholderTextColor={color.muted}
            style={styles.input}
          />
          {nairaPreview ? (
            <Text style={styles.hint}>Customers will see {nairaPreview}</Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>How many do you have?</Text>
          <TextInput
            value={stock}
            onChangeText={setStock}
            keyboardType="number-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Show on my storefront</Text>
            <Text style={styles.hint}>Turn off to save it without publishing.</Text>
          </View>
          <Switch
            value={live}
            onValueChange={setLive}
            trackColor={{ true: color.primary, false: color.line }}
          />
        </View>

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
        <Text style={styles.footnote}>
          Options, categories and descriptions can be added on the web dashboard.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Mirrors the web form's slug derivation so both produce the same URL. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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
  field: { gap: space.xs },
  label: { ...text.small, color: color.ink, fontFamily: font.medium },
  hint: { ...text.small, color: color.muted },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: color.ink,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  switchText: { flex: 1, gap: 2 },
  error: { ...text.small, color: color.danger },
  footnote: { ...text.small, color: color.muted, textAlign: 'center' },
});
