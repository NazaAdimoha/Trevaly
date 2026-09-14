import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { api, toApiError } from '@/api/client';
import { useQuery } from '@/api/hooks';
import { storeSettingsResponseSchema } from '@/api/schemas';
import { uploadProductImage } from '@/api/upload';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import { Button, ErrorState, Loading, StoreAvatar } from '@/ui';

/**
 * Store settings — name, tagline, and the logo.
 *
 * This screen exists because the link that used to sit in Settings pointed at a
 * web page that was never built, so no merchant could set a logo at all and the
 * avatar we render everywhere had nothing to render.
 *
 * The logo goes to Cloudinary straight from the phone and only the PUBLIC ID is
 * sent to our API — bytes never pass through our server, and a stored id lets
 * the storefront, the app and the OG card each derive their own size instead of
 * sharing one frozen transformation.
 */
export default function StoreSettingsScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();

  const settings = useQuery(
    slug ? `/stores/${slug}/settings` : null,
    storeSettingsResponseSchema,
    [slug],
  );

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPublicId, setLogoPublicId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Seed the form once, when the server answers.
   *
   * Done during render rather than in an effect. An effect costs a second
   * render on every load and — the part that actually matters — will overwrite
   * anything the merchant typed while the request was still in flight. `seeded`
   * makes it happen exactly once per payload.
   */
  const [seeded, setSeeded] = useState(false);
  if (!seeded && settings.data) {
    setSeeded(true);
    setName(settings.data.name);
    setTagline(settings.data.tagline ?? '');
    setLogoUrl(settings.data.logoUrl);
    setLogoPublicId(settings.data.logoPublicId);
  }

  const pickLogo = async () => {
    if (!slug) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Photos permission needed',
        'Allow photo access to choose a logo.',
      );
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Square, because every surface renders the logo in a square: the avatar
      // in the app, the OG card, the storefront header tile. Cropping here beats
      // discovering the crop was wrong on three screens later.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (picked.canceled || !picked.assets[0]) return;

    const asset = picked.assets[0];
    setUploading(true);
    setError(null);
    try {
      const publicId = await uploadProductImage(
        slug,
        {
          uri: asset.uri,
          mimeType: asset.mimeType,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
        },
        'branding',
      );
      setLogoPublicId(publicId);
      // Show the local file immediately: the Cloudinary URL for a just-uploaded
      // asset can 404 for a moment, and a blank square reads as a failure.
      setLogoUrl(asset.uri);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!slug || saving) return;
    if (name.trim().length < 2) {
      setError('Give your store a name.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.patch(`/stores/${slug}/settings`, {
        name: name.trim(),
        tagline: tagline.trim() || null,
        logoPublicId,
      });
      router.back();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (!slug) {
    return <ErrorState message='Pick a store on the Today tab first.' />;
  }
  if (settings.loading && !settings.data) return <Loading />;
  if (settings.error && !settings.data) {
    return (
      <ErrorState message={settings.error.message} onRetry={settings.refresh} />
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Store settings' }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps='handled'
        >
          <View style={styles.logoBlock}>
            <StoreAvatar name={name || 'Store'} logoUrl={logoUrl} size={96} />
            <Pressable
              onPress={() => void pickLogo()}
              disabled={uploading}
              accessibilityRole='button'
              style={({ pressed }) => [
                styles.logoButton,
                pressed && styles.logoButtonPressed,
              ]}
            >
              <Text style={styles.logoButtonText}>
                {uploading
                  ? 'Uploading…'
                  : logoPublicId
                    ? 'Change logo'
                    : 'Add a logo'}
              </Text>
            </Pressable>
            {logoPublicId ? (
              <Pressable
                onPress={() => {
                  setLogoPublicId(null);
                  setLogoUrl(null);
                }}
                accessibilityRole='button'
                hitSlop={8}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            ) : (
              <Text style={styles.hint}>
                Square works best. Shown on your storefront and here.
              </Text>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Store name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder='Adaobi Fashion Store'
              placeholderTextColor={color.muted}
              style={styles.input}
              maxLength={80}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tagline</Text>
            <TextInput
              value={tagline}
              onChangeText={setTagline}
              placeholder='Order online and pay securely.'
              placeholderTextColor={color.muted}
              style={[styles.input, styles.multiline]}
              multiline
              maxLength={140}
            />
            <Text style={styles.hint}>
              Appears under your store name on the storefront.
            </Text>
          </View>

          {error ? (
            <Text style={styles.error} accessibilityRole='alert'>
              {error}
            </Text>
          ) : null}
        </ScrollView>

        {/* Pinned, not at the end of the scroll: on a long form the merchant
            should never have to scroll to find out how to commit. */}
        <View style={styles.footer}>
          <Button
            label='Save changes'
            onPress={() => void save()}
            busy={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.ground },
  page: { padding: space.lg, gap: space.xl, paddingBottom: space.xxl },
  logoBlock: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  logoButton: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.primary700,
  },
  logoButtonPressed: { backgroundColor: color.primary50 },
  logoButtonText: { ...text.small, color: color.primary700, fontFamily: font.semibold },
  removeText: { ...text.small, color: color.danger },
  field: { gap: space.sm },
  label: { ...text.small, color: color.ink, fontFamily: font.semibold },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    fontSize: 16,
    color: color.ink,
  },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  hint: { ...text.small, color: color.muted, textAlign: 'center' },
  error: { ...text.small, color: color.danger },
  footer: {
    padding: space.lg,
    borderTopWidth: 1,
    borderTopColor: color.line,
    backgroundColor: color.surface,
  },
});
