import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { api, toApiError } from '@/api/client';
import { imageUrl, useAppConfig } from '@/api/config';
import { useQuery } from '@/api/hooks';
import { categoryListSchema, productDetailSchema } from '@/api/schemas';
import {
  draftFrom,
  type ProductDraft,
  ProductFields,
  toPayload,
} from '@/products/form';
import { useActiveStore } from '@/store/active-store';
import { color, radius, space, text } from '@/theme';
import { Button, ErrorState, Loading } from '@/ui';

/**
 * Edit one product, or delete it.
 *
 * Before this the app could only ADD. A merchant who mistyped a price, sold out
 * of a size, or wanted to write a description had to find a laptop — and the
 * list was a wall of rows that did nothing when tapped.
 */
export default function ProductScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();
  const { id } = useLocalSearchParams<{ id: string }>();
  const config = useAppConfig();

  const product = useQuery(
    slug && id ? `/stores/${slug}/products/${id}` : null,
    productDetailSchema,
    [slug, id],
  );
  const categories = useQuery(
    slug ? `/stores/${slug}/categories` : null,
    categoryListSchema,
    [slug],
  );

  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Seed once, during render rather than in an effect.
   *
   * An effect costs a second render on every load and — the part that matters —
   * would overwrite whatever the merchant typed while a background refresh was
   * still in flight. `useQuery` revalidates behind the screen, so that is a
   * real race, not a theoretical one.
   */
  if (draft === null && product.data) setDraft(draftFrom(product.data));

  if (product.loading && !draft) return <Loading />;
  if (product.error && !draft) {
    return <ErrorState message={product.error.message} onRetry={() => void product.refresh()} />;
  }
  if (!draft || !product.data) return <Loading />;

  const cover = imageUrl(config?.cloudinaryCloudName, product.data.imageUrls[0]);

  const save = async () => {
    if (!slug || !id) return;
    setError(null);

    const built = toPayload(draft, product.data!.imageUrls);
    if ('error' in built) return setError(built.error);

    setBusy(true);
    try {
      await api.patch(`/stores/${slug}/products/${id}`, built.payload);
      router.back();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      `Delete ${product.data!.name}?`,
      'This cannot be undone. If it has already been ordered, hide it instead — its orders have to keep pointing at it.',
      [
        { text: 'Keep', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void remove() },
      ],
    );
  };

  const remove = async () => {
    if (!slug || !id) return;
    setBusy(true);
    setError(null);
    try {
      await api.delete(`/stores/${slug}/products/${id}`);
      router.back();
    } catch (err) {
      const failure = toApiError(err);
      // 409 is the deliberate one: a product on an existing order is retired,
      // never deleted, or the order history rewrites itself. The API's wording
      // already says to hide it instead, so it is shown verbatim.
      setError(failure.message);
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: product.data.name }} />

      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps='handled'>
        {cover ? (
          <View style={styles.cover}>
            {/* Photos are still changed when adding, not here — swapping one
                is a different job from correcting a price, and conflating them
                is how an edit screen becomes a wall. */}
            <Text style={styles.coverNote}>
              {product.data.imageUrls.length} photo
              {product.data.imageUrls.length === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}

        <ProductFields
          draft={draft}
          onChange={setDraft}
          categories={categories.data?.items ?? []}
        />

        {error ? (
          <Text style={styles.error} accessibilityRole='alert'>
            {error}
          </Text>
        ) : null}

        <Button label='Save changes' onPress={() => void save()} busy={busy} />

        <Pressable
          onPress={confirmDelete}
          disabled={busy}
          accessibilityRole='button'
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>Delete this product</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.ground },
  page: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  cover: {
    borderRadius: radius.md,
    backgroundColor: color.sunk,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  coverNote: { ...text.small, color: color.muted },
  error: { ...text.small, color: color.danger },
  delete: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: { ...text.small, color: color.danger },
  pressed: { opacity: 0.7 },
});
