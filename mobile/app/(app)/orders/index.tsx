import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { OrderStatus } from '@core/enums';

import { useQuery } from '@/api/hooks';
import { type OrderListItem, orderListSchema } from '@/api/schemas';
import { useActiveStore } from '@/store/active-store';
import { HIT, color, font, radius, space, text } from '@/theme';
import {
  EmptyStateAction,
  ErrorState,
  FilterChips,
  Loading,
  Money,
  SearchField,
  StaleNotice,
  StatusPill,
} from '@/ui';

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Paid', value: OrderStatus.PAID },
  { label: 'Shipped', value: OrderStatus.SHIPPED },
  { label: 'Pending', value: OrderStatus.PENDING },
] as const;

/**
 * The orders list.
 *
 * Sorted newest first by the API, which is what a merchant checking their phone
 * actually wants — "what came in while I was out", not a ledger. Anything
 * flagged `hasStockIssue` is called out inline: it is a paid order the store
 * cannot fulfil, and it will not fix itself.
 */
export default function OrdersScreen() {
  const router = useRouter();
  const { slug, ready } = useActiveStore();
  const [status, setStatus] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const query = status ? `?status=${status}` : '';
  const orders = useQuery(
    slug ? `/stores/${slug}/orders${query}` : null,
    orderListSchema,
    [slug, status],
  );

  // Above the early returns, not below them. React counts hooks by call order,
  // so a `useMemo` after a conditional `return` runs on some renders and not
  // others — which crashes the screen the moment the list finishes loading.
  const all = orders.data?.items ?? [];

  // Status is a server filter (it changes the query); search is local. A
  // merchant hunting one order usually knows the customer's name or the number,
  // and both are already on screen.
  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter(
      (o) =>
        o.customerName.toLowerCase().includes(term) ||
        String(o.orderNumber).includes(term),
    );
  }, [all, search]);


  if (ready && !slug) {
    return (
      <EmptyStateAction
        icon="storefront-outline"
        title="No store selected"
        body="Pick a store on the Today tab to see its orders."
      />
    );
  }
  if (orders.loading) return <Loading />;
  // Only a screen with nothing on it shows the error. Offline with a warm cache
  // sets `error` AND keeps `data`; the merchant is better served by yesterday's
  // orders under a staleness banner than by a retry button.
  if (orders.error && !orders.data) {
    return <ErrorState message={orders.error.message} onRetry={orders.refresh} />;
  }

  return (
    <View style={styles.flex}>
      {orders.stale ? <StaleNotice updatedAt={orders.updatedAt} /> : null}
      <View style={styles.filters}>
        <SearchField
          value={search}
          onChangeText={setSearch}
          placeholder="Search by customer or order number"
        />
        <FilterChips
          value={status}
          onChange={setStatus}
          options={FILTERS.map((f) => ({ label: f.label, value: f.value }))}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(order) => order.id}
        contentContainerStyle={items.length === 0 ? styles.flex : styles.list}
        refreshControl={
          <RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} />
        }
        ListEmptyComponent={
          search.trim() ? (
            <EmptyStateAction
              icon="search-outline"
              title="Nothing matches"
              body="No order with that customer or number on this list."
              actionLabel="Clear search"
              onAction={() => setSearch('')}
            />
          ) : (
            <EmptyStateAction
              icon="receipt-outline"
              title="Nothing here yet"
              body={
                status
                  ? 'No orders with that status right now.'
                  : 'Orders appear the moment a customer pays. Share your store link to get the first one.'
              }
            />
          )
        }
        renderItem={({ item }) => (
          <OrderRow order={item} onPress={() => router.push(`/(app)/orders/${item.id}`)} />
        )}
      />
    </View>
  );
}

function OrderRow({
  order,
  onPress,
}: {
  order: OrderListItem;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <StatusPill status={order.status} />
      </View>
      <Text style={styles.customer} numberOfLines={1}>
        {order.customerName}
      </Text>
      <View style={styles.rowBottom}>
        <Money kobo={order.totalKobo} style={styles.total} />
        <Text style={styles.date}>{formatWhen(order.createdAt)}</Text>
      </View>
      {order.hasStockIssue ? (
        <Text style={styles.issue}>Paid, but stock ran out — needs attention</Text>
      ) : null}
    </Pressable>
  );
}

/** Relative for the recent past, which is all a merchant scans for. */
function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / (60 * 24))}d ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxl, gap: space.md },
  row: {
    minHeight: HIT,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
    gap: space.xs,
  },
  rowPressed: { backgroundColor: color.sunk },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { ...text.heading, color: color.ink, fontVariant: ['tabular-nums'] },
  customer: { ...text.body, color: color.body },
  rowBottom: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: space.xs,
  },
  total: { fontFamily: font.semibold },
  date: { ...text.small, color: color.muted },
  issue: { ...text.small, color: color.warning, marginTop: space.xs },
});
