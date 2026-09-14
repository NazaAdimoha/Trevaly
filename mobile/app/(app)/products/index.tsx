import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { availableStock, displayPriceKobo, hasPriceRange } from '@core/variants';

import { imageUrl, useAppConfig } from '@/api/config';
import { useQuery } from '@/api/hooks';
import { type ProductListItem, productListSchema } from '@/api/schemas';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import {
  Button,
  EmptyStateAction,
  ErrorState,
  FilterChips,
  Loading,
  Money,
  SearchField,
  StaleNotice,
} from '@/ui';

type ProductFilter = 'all' | 'active' | 'inactive' | 'out';

/**
 * Products, ordered so the useful thing is first: what is running out.
 *
 * Availability and price come from `@core/variants` — the same functions the
 * storefront grid and `/api/checkout` use. A merchant must never see "in stock"
 * on the phone for something the checkout would refuse, and sharing the
 * function is the only way to guarantee that.
 */
export default function ProductsScreen() {
  const router = useRouter();
  const { slug, ready } = useActiveStore();
  const config = useAppConfig();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProductFilter>('all');

  const products = useQuery(
    slug ? `/stores/${slug}/products?pageSize=100` : null,
    productListSchema,
    [slug],
  );

  // `all` and both memos sit ABOVE the early returns on purpose. React counts
  // hooks by call order, so a `useMemo` after a conditional `return` runs on
  // some renders and not others — which is exactly the "rendered more hooks
  // than during the previous render" crash this screen threw the moment the
  // list finished loading.
  const all = products.data?.items ?? [];

  // Filtered in memory, not re-fetched. The list is already here, the merchant
  // is often on one bar of signal, and a request per keystroke would be slower
  // and sometimes simply fail.
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    return all
      .filter((p) => {
        if (filter === 'active' && !p.isActive) return false;
        if (filter === 'inactive' && p.isActive) return false;
        if (filter === 'out' && stockOf(p) > 0) return false;
        if (!term) return true;
        return (
          p.name.toLowerCase().includes(term) ||
          (p.sku ?? '').toLowerCase().includes(term)
        );
      })
      .sort((a, b) => stockOf(a) - stockOf(b));
  }, [all, search, filter]);

  const counts = useMemo(
    () => ({
      all: all.length,
      active: all.filter((p) => p.isActive).length,
      inactive: all.filter((p) => !p.isActive).length,
      out: all.filter((p) => stockOf(p) === 0).length,
    }),
    [all],
  );

  // `ready` without a slug means the merchant has no store selected yet —
  // distinct from "still loading", and it must not render as "no products".
  if (ready && !slug) {
    return (
      <EmptyStateAction
        icon="storefront-outline"
        title="No store selected"
        body="Pick a store on the Today tab and your products will appear here."
      />
    );
  }
  if (products.loading) return <Loading />;
  // See the note in the orders screen: cached data beats a retry button.
  if (products.error && !products.data) {
    return <ErrorState message={products.error.message} onRetry={products.refresh} />;
  }

  return (
    <View style={styles.flex}>
      {products.stale ? <StaleNotice updatedAt={products.updatedAt} /> : null}
      <View style={styles.header}>
        <Button
          label="Add a product"
          onPress={() => router.push('/(app)/products/new')}
        />
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or SKU"
        />
        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'All', value: 'all', count: counts.all },
            { label: 'Live', value: 'active', count: counts.active },
            { label: 'Hidden', value: 'inactive', count: counts.inactive },
            { label: 'Out of stock', value: 'out', count: counts.out },
          ]}
        />
        <Text style={styles.resultCount}>
          {items.length === all.length
            ? `${all.length} product${all.length === 1 ? '' : 's'}`
            : `Showing ${items.length} of ${all.length}`}
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(product) => product.id}
        contentContainerStyle={items.length === 0 ? styles.flex : styles.list}
        refreshControl={
          <RefreshControl refreshing={products.refreshing} onRefresh={products.refresh} />
        }
        ListEmptyComponent={
          all.length === 0 ? (
            <EmptyStateAction
              icon="pricetags-outline"
              title="No products yet"
              body="Add the first one and it appears on your storefront straight away."
              actionLabel="Add a product"
              onAction={() => router.push('/(app)/products/new')}
            />
          ) : (
            // A filter matching nothing is a different problem from an empty
            // catalogue, and offering "Add a product" here would be answering a
            // question the merchant did not ask.
            <EmptyStateAction
              icon="search-outline"
              title="Nothing matches"
              body="Try a different search, or clear the filter."
              actionLabel="Clear"
              onAction={() => {
                setSearch('');
                setFilter('all');
              }}
            />
          )
        }
        renderItem={({ item }) => (
          <ProductRow
            product={item}
            cloudName={config?.cloudinaryCloudName ?? null}
          />
        )}
      />
    </View>
  );
}

function ProductRow({
  product,
  cloudName,
}: {
  product: ProductListItem;
  cloudName: string | null;
}) {
  const thumb = imageUrl(cloudName, product.imageUrls[0], 160);
  const shaped = {
    priceKobo: product.priceKobo,
    stock: product.stock,
    optionName: product.optionName,
    variants: product.variants ?? [],
  };
  const stock = availableStock(shaped);
  const range = hasPriceRange(shaped);

  return (
    <View style={styles.row}>
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Text style={styles.thumbHint}>No{'\n'}photo</Text>
        </View>
      )}
      <View style={styles.rowMain}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceLine}>
          {range ? <Text style={styles.from}>From</Text> : null}
          <Money kobo={displayPriceKobo(shaped)} style={styles.price} />
        </View>
        {product.optionName && product.variants?.length ? (
          <Text style={styles.variants}>
            {product.optionName}:{' '}
            {product.variants
              .filter((variant) => variant.isActive)
              .map((variant) => `${variant.value} (${variant.stock})`)
              .join(' · ')}
          </Text>
        ) : null}
      </View>

      <StockBadge stock={stock} live={product.isActive} />
    </View>
  );
}

/**
 * Stock as a number AND a colour AND a word — never colour alone. A merchant
 * scanning this in a shop should spot "out" without reading it.
 */
function StockBadge({ stock, live }: { stock: number; live: boolean }) {
  if (!live) {
    return (
      <View style={[styles.badge, { backgroundColor: color.sunk }]}>
        <Text style={[styles.badgeText, { color: color.muted }]}>Hidden</Text>
      </View>
    );
  }

  const tone =
    stock === 0
      ? { bg: color.dangerBg, fg: color.danger, label: 'Out' }
      : stock <= 5
        ? { bg: color.warningBg, fg: color.warning, label: `${stock} left` }
        : { bg: color.successBg, fg: color.success, label: `${stock} in stock` };

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
    </View>
  );
}

function stockOf(product: ProductListItem): number {
  return availableStock({
    priceKobo: product.priceKobo,
    stock: product.stock,
    optionName: product.optionName,
    variants: product.variants ?? [],
  });
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  resultCount: { ...text.small, color: color.muted },
  header: { padding: space.lg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
  },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: color.sunk },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbHint: { fontSize: 9, color: color.muted, textAlign: 'center' },
  rowMain: { flex: 1, gap: 2 },
  name: { ...text.body, color: color.ink, fontFamily: font.medium },
  priceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  from: { ...text.small, color: color.muted },
  price: { ...text.small, color: color.body },
  variants: { ...text.small, color: color.muted, marginTop: 2 },
  badge: {
    paddingHorizontal: space.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontFamily: font.semibold },
});
