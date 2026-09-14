import { useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  myStoresResponseSchema,
  storeOverviewResponseSchema,
} from '@core/api/contracts';

import { useQuery } from '@/api/hooks';
import { orderListSchema } from '@/api/schemas';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import {
  Button,
  Card,
  ErrorState,
  formatNaira,
  Loading,
  Money,
  QuickAction,
  StaleNotice,
  StatTile,
  StatusPill,
  StoreAvatar,
} from '@/ui';

/**
 * Home — the first thing a merchant sees.
 *
 * Laid out to match the reference app screen for screen, because that layout is
 * doing something specific: identity first, then the one number they opened the
 * app for, then the four counts, then the things they came to DO. Numbers they
 * read, actions they tap — and the actions are above the fold, not behind a tab.
 *
 * The one place we deliberately diverge is the money card. The reference app
 * shows a WALLET BALANCE it holds on the merchant's behalf. We never hold a
 * merchant's money — Paystack splits at settlement straight into their own
 * account — so showing a balance would be a lie about the product. The same
 * slot shows takings for the period instead, and says where the money went.
 */

const PERIODS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
] as const;

type PeriodValue = (typeof PERIODS)[number]['value'];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useUser();
  const { slug, ready, choose } = useActiveStore();

  const [period, setPeriod] = useState<PeriodValue>('week');
  const [hideMoney, setHideMoney] = useState(false);

  const stores = useQuery(
    ready && !slug ? '/me/stores' : null,
    myStoresResponseSchema,
  );

  // Pick the only store automatically. A merchant with one shop should never be
  // asked which shop. In an effect, not during render: `choose` writes state,
  // and calling it inline re-renders straight back into the same branch.
  const items = stores.data?.items;
  useEffect(() => {
    if (slug || !items || items.length !== 1) return;
    void choose(items[0].slug);
  }, [slug, items, choose]);

  const overview = useQuery(
    slug ? `/stores/${slug}/overview?period=${period}` : null,
    storeOverviewResponseSchema,
    [slug, period],
  );

  const recent = useQuery(
    slug ? `/stores/${slug}/orders?pageSize=5` : null,
    orderListSchema,
    [slug],
  );

  // Every hook above every early return — React counts hooks by call order.
  const firstName = user?.firstName ?? null;
  const store = overview.data?.store;
  const storefrontUrl = store?.storefrontUrl ?? null;

  /**
   * Hand the storefront address to the OS share sheet.
   *
   * `message` carries the URL as well as `url`: WhatsApp — where this link
   * actually goes — takes the message body and drops the separate url field, so
   * sharing without it sends a bare store name and no way to reach the shop.
   */
  const shareStore = async () => {
    if (!storefrontUrl) return;
    try {
      await Share.share({
        message: `Shop ${store?.name ?? 'my shop'} — ${storefrontUrl}`,
        url: storefrontUrl,
      });
    } catch {
      // Dismissed, or the OS refused. Nothing to say.
    }
  };

  if (!ready || (!slug && stores.loading)) return <Loading />;

  if (!slug) {
    const options = items ?? [];
    if (stores.error) {
      return <ErrorState message={stores.error.message} onRetry={stores.refresh} />;
    }
    if (options.length === 0) {
      return (
        <ErrorState message="This account is not attached to a store yet. Ask your operator to add you." />
      );
    }
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <Text style={styles.heading}>Choose a store</Text>
        {options.map((option) => (
          <Card key={option.id} elevated style={styles.storeCard}>
            <View style={styles.storeCardHead}>
              <StoreAvatar name={option.name} logoUrl={option.logoUrl} size={44} />
              <View style={styles.flex}>
                <Text style={styles.storeName}>{option.name}</Text>
                <Text style={styles.storeMeta}>
                  {option.slug} · {option.role.toLowerCase()}
                </Text>
              </View>
            </View>
            <Button label="Open" onPress={() => void choose(option.slug)} />
          </Card>
        ))}
      </ScrollView>
    );
  }

  if (overview.loading && !overview.data) return <Loading />;
  if (overview.error && !overview.data) {
    return <ErrorState message={overview.error.message} onRetry={overview.refresh} />;
  }
  if (!overview.data || !store) return null;

  const { stats, deltas } = overview.data;
  const periodLabel =
    PERIODS.find((p) => p.value === period)?.label ?? 'This week';

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl
          refreshing={overview.refreshing}
          onRefresh={() => {
            void overview.refresh();
            void recent.refresh();
          }}
        />
      }
    >
      {overview.stale ? <StaleNotice updatedAt={overview.updatedAt} /> : null}

      {/* ── Greeting ─────────────────────────────────────────────────────── */}
      <View style={styles.greeting}>
        <StoreAvatar name={store.name} logoUrl={store.logoUrl} size={46} />
        <View style={styles.flex}>
          <Text style={styles.hi}>
            {firstName ? `Hi, ${firstName}` : 'Welcome back'}
          </Text>
          <Text style={styles.storeSub} numberOfLines={1}>
            {store.name}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(app)/notifications')}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          hitSlop={8}
          style={styles.bell}
        >
          <Ionicons name="notifications-outline" size={22} color={color.ink} />
          {stats.needsAttention > 0 ? (
            <View style={styles.bellBadge}>
              <Text style={styles.bellBadgeText}>
                {stats.needsAttention > 9 ? '9+' : stats.needsAttention}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.headerActions}>
        <Pressable
          onPress={() => storefrontUrl && void Linking.openURL(storefrontUrl)}
          disabled={!storefrontUrl}
          accessibilityRole="link"
          style={({ pressed }) => [
            styles.headerAction,
            pressed && styles.headerActionPressed,
            !storefrontUrl && styles.headerActionDisabled,
          ]}
        >
          <Ionicons name="storefront-outline" size={15} color={color.primary700} />
          <Text style={styles.headerActionLabel}>Visit store</Text>
        </Pressable>
        <Pressable
          onPress={() => void shareStore()}
          disabled={!storefrontUrl}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.headerAction,
            pressed && styles.headerActionPressed,
            !storefrontUrl && styles.headerActionDisabled,
          ]}
        >
          <Ionicons name="share-outline" size={15} color={color.primary700} />
          <Text style={styles.headerActionLabel}>Share link</Text>
        </Pressable>
      </View>

      {/* ── Takings ──────────────────────────────────────────────────────── */}
      <Card elevated style={styles.moneyCard}>
        <View style={styles.moneyHead}>
          <Text style={styles.moneyLabel}>Taken so far</Text>
          <PeriodPicker value={period} onChange={setPeriod} />
        </View>

        <View style={styles.moneyRow}>
          <Text style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit>
            {hideMoney ? '₦ ••••••' : formatNaira(stats.revenueKobo)}
          </Text>
          <Pressable
            onPress={() => setHideMoney((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hideMoney ? 'Show takings' : 'Hide takings'}
          >
            <Ionicons
              name={hideMoney ? 'eye-off-outline' : 'eye-outline'}
              size={19}
              color={color.muted}
            />
          </Pressable>
        </View>

        {deltas?.revenuePercent !== null && deltas?.revenuePercent !== undefined ? (
          <Delta percent={deltas.revenuePercent} periodLabel={periodLabel} />
        ) : null}

        {/* The reassurance the whole product is built on, where the reference
            app puts a wallet balance. */}
        <View style={styles.settleRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={color.primary700} />
          <Text style={styles.settleText}>
            Paystack settles this straight to your bank account.
          </Text>
        </View>
      </Card>

      {/* ── Counts ───────────────────────────────────────────────────────── */}
      <View style={styles.grid}>
        <StatTile tone="green" value={stats.paidOrders} label="Orders" />
        <StatTile tone="blue" value={stats.newCustomers ?? 0} label="Customers" />
        <StatTile tone="amber" value={stats.pendingOrders} label="Pending" />
        <StatTile tone="rose" value={stats.activeProducts} label="Products live" />
      </View>

      {/* ── Report ───────────────────────────────────────────────────────── */}
      <Pressable
        onPress={() => router.push('/(app)/analytics')}
        accessibilityRole="button"
        style={({ pressed }) => [styles.report, pressed && { opacity: 0.9 }]}
      >
        <View style={styles.flex}>
          <Text style={styles.reportTitle}>Business report</Text>
          <Text style={styles.reportBody}>See how the store is doing</Text>
        </View>
        <View style={styles.reportIcon}>
          <Ionicons name="bar-chart-outline" size={19} color={color.primary700} />
        </View>
      </Pressable>

      {/* ── Do ───────────────────────────────────────────────────────────── */}
      <View style={styles.quickRow}>
        <QuickAction
          icon="add-circle-outline"
          label="Add product"
          onPress={() => router.push('/(app)/products/new')}
        />
        <QuickAction
          icon="receipt-outline"
          label="Orders"
          onPress={() => router.push('/(app)/orders')}
        />
        <QuickAction
          icon="share-social-outline"
          label="Share store"
          onPress={() => void shareStore()}
        />
        <QuickAction
          icon="storefront-outline"
          label="Store setup"
          onPress={() => router.push('/(app)/store-settings')}
        />
      </View>

      {/* ── Latest orders ────────────────────────────────────────────────── */}
      <View style={styles.recentHeader}>
        <Text style={styles.sectionTitle}>Latest orders</Text>
        <Pressable
          onPress={() => router.push('/(app)/orders')}
          accessibilityRole="button"
          hitSlop={8}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>

      {(recent.data?.items ?? []).length === 0 ? (
        <Card>
          <Text style={styles.emptyRecent}>
            Nothing yet. Orders appear here the moment a customer pays.
          </Text>
        </Card>
      ) : (
        <Card elevated style={styles.recentCard}>
          {(recent.data?.items ?? []).map((order, index) => (
            <Pressable
              key={order.id}
              onPress={() => router.push(`/(app)/orders/${order.id}`)}
              accessibilityRole="button"
              style={[styles.recentRow, index > 0 && styles.recentRowDivided]}
            >
              <View style={styles.flex}>
                <Text style={styles.recentNumber}>#{order.orderNumber}</Text>
                <Text style={styles.recentCustomer} numberOfLines={1}>
                  {order.customerName}
                </Text>
              </View>
              <Money kobo={order.totalKobo} style={styles.recentTotal} />
              <StatusPill status={order.status} />
            </Pressable>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

/** The period chip, matching the reference app's `This Week ⌄`. */
function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodValue;
  onChange: (next: PeriodValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = PERIODS.find((p) => p.value === value)?.label ?? '';

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        style={styles.periodChip}
      >
        <Text style={styles.periodLabel}>{label}</Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={color.body}
        />
      </Pressable>

      {/* Absolute rather than a modal: three options do not warrant taking over
          the screen, and a sheet here would hide the number being changed. */}
      {open ? (
        <View style={styles.periodMenu}>
          {PERIODS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: option.value === value }}
              style={({ pressed }) => [
                styles.periodOption,
                pressed && { backgroundColor: color.sunk },
              ]}
            >
              <Text
                style={[
                  styles.periodOptionText,
                  option.value === value && styles.periodOptionActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** "↗ 12% from last week" — direction carried by arrow AND colour. */
function Delta({
  percent,
  periodLabel,
}: {
  percent: number;
  periodLabel: string;
}) {
  const up = percent >= 0;
  const previous = periodLabel.toLowerCase().replace('this', 'last');
  return (
    <View style={styles.deltaRow}>
      <Ionicons
        name={up ? 'arrow-up' : 'arrow-down'}
        size={13}
        color={up ? color.success : color.danger}
      />
      <Text style={[styles.deltaText, { color: up ? color.success : color.danger }]}>
        {Math.abs(percent)}% from {previous}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  flex: { flex: 1 },
  heading: { ...text.display, color: color.ink },

  greeting: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  hi: { ...text.title, color: color.ink },
  storeSub: { ...text.small, color: color.muted },
  bell: { padding: space.xs },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.danger,
  },
  bellBadgeText: { fontFamily: font.bold, fontSize: 10, color: '#FFFFFF' },

  headerActions: { flexDirection: 'row', gap: space.sm },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  headerActionPressed: { backgroundColor: color.sunk },
  headerActionDisabled: { opacity: 0.5 },
  headerActionLabel: { ...text.small, color: color.ink, fontFamily: font.semibold },

  moneyCard: { gap: space.sm },
  moneyHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  moneyLabel: { ...text.small, color: color.muted },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  moneyValue: { ...text.figure, color: color.ink, flex: 1 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  deltaText: { ...text.small, fontFamily: font.medium },
  settleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
  },
  settleText: { ...text.small, color: color.body, flex: 1 },

  periodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.sunk,
  },
  periodLabel: { ...text.small, color: color.body, fontFamily: font.medium },
  periodMenu: {
    position: 'absolute',
    top: 36,
    right: 0,
    minWidth: 148,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
    zIndex: 10,
    elevation: 8,
    shadowColor: color.forest900,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  periodOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: space.lg },
  periodOptionText: { ...text.small, color: color.ink },
  periodOptionActive: { color: color.primary700, fontFamily: font.semibold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  report: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: color.forest900,
    borderRadius: radius.md,
    padding: space.lg,
  },
  reportTitle: { ...text.heading, color: '#FFFFFF' },
  reportBody: { ...text.small, color: color.primary200 },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  sectionTitle: { ...text.heading, color: color.ink },
  seeAll: { ...text.small, color: color.primary700, fontFamily: font.semibold },
  recentCard: { paddingVertical: space.xs },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingVertical: space.sm,
  },
  recentRowDivided: { borderTopWidth: 1, borderTopColor: color.lineSoft },
  recentNumber: { ...text.small, color: color.ink, fontFamily: font.semibold },
  recentCustomer: { ...text.small, color: color.muted },
  recentTotal: { ...text.small, fontFamily: font.semibold },
  emptyRecent: { ...text.small, color: color.muted },

  storeCard: { gap: space.md },
  storeCardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  storeName: { ...text.heading, color: color.ink },
  storeMeta: { ...text.small, color: color.muted },
});
