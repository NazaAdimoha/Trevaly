import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { storeOverviewResponseSchema } from '@core/api/contracts';

import { useQuery } from '@/api/hooks';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import {
  type DateRange,
  DateRangeChip,
  ErrorState,
  formatNaira,
  Loading,
  StaleNotice,
} from '@/ui';

/**
 * Analytics.
 *
 * Three tabs over one request. Every figure on all three tabs comes from the
 * same `/overview` payload, so switching tabs is instant and cannot show two
 * tabs disagreeing about the same week — which is what happens when each tab
 * fetches its own numbers and one of them is a few seconds stale.
 *
 * Every card that CAN carry a comparison does. A number with no context is
 * trivia; "₦314,000, up 12% on last week" is the thing a merchant acts on.
 */

const TABS = ['Sales', 'Products', 'Customers'] as const;
type Tab = (typeof TABS)[number];

const PERIODS = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'All time', value: 'all' },
] as const;
type PeriodValue = (typeof PERIODS)[number]['value'];

export default function AnalyticsScreen() {
  const { slug } = useActiveStore();
  const [tab, setTab] = useState<Tab>('Sales');
  const [period, setPeriod] = useState<PeriodValue>('week');
  const [range, setRange] = useState<DateRange>(null);

  // An explicit range overrides the named period — the merchant picked actual
  // dates, and quietly ignoring them for "this week" would be a lie.
  const query = range
    ? `period=custom&from=${range.from.toISOString()}&to=${range.to.toISOString()}`
    : `period=${period}`;

  const overview = useQuery(
    slug ? `/stores/${slug}/overview?${query}` : null,
    storeOverviewResponseSchema,
    [slug, query],
  );

  if (!slug) {
    return <ErrorState message="Pick a store on the Home tab first." />;
  }
  if (overview.loading && !overview.data) return <Loading />;
  if (overview.error && !overview.data) {
    return <ErrorState message={overview.error.message} onRetry={overview.refresh} />;
  }
  if (!overview.data) return null;

  const { stats, deltas } = overview.data;
  const comparison = range ? 'the period before' : periodComparisonLabel(period);

  return (
    <>
      <Stack.Screen options={{ title: 'Analytics' }} />
      <ScrollView contentContainerStyle={styles.page}>
        {overview.stale ? <StaleNotice updatedAt={overview.updatedAt} /> : null}

        <View style={styles.tabs}>
          {TABS.map((name) => {
            const active = name === tab;
            return (
              <Pressable
                key={name}
                onPress={() => setTab(name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.filters}>
          <DateRangeChip value={range} onChange={setRange} />
          {/* Disabled, not hidden, while a range is set: hiding it would leave
              the merchant unsure how to get back to "this week". */}
          <View style={range ? styles.dimmed : undefined}>
            <PeriodChips
              value={period}
              onChange={setPeriod}
              disabled={range !== null}
            />
          </View>
        </View>

        {tab === 'Sales' ? (
          <View style={styles.grid}>
            <Metric
              label="Total sales"
              value={formatNaira(stats.revenueKobo)}
              delta={deltas?.revenuePercent}
              comparison={comparison}
            />
            <Metric
              label="Paid orders"
              value={String(stats.paidOrders)}
              delta={deltas?.paidOrdersPercent}
              comparison={comparison}
            />
            <Metric label="Awaiting payment" value={String(stats.pendingOrders)} />
            <Metric
              label="Needs attention"
              value={String(stats.needsAttention)}
              tone={stats.needsAttention > 0 ? 'warn' : undefined}
            />
          </View>
        ) : null}

        {tab === 'Products' ? (
          <View style={styles.grid}>
            <Metric label="Products live" value={String(stats.activeProducts)} />
            <Metric label="Products total" value={String(stats.productCount)} />
            <Metric
              label="Hidden"
              value={String(stats.productCount - stats.activeProducts)}
            />
          </View>
        ) : null}

        {tab === 'Customers' ? (
          <View style={styles.grid}>
            <Metric label="Customers" value={String(stats.newCustomers ?? 0)} />
            <Metric
              label="Avg. order value"
              value={
                stats.paidOrders > 0
                  ? formatNaira(Math.round(stats.revenueKobo / stats.paidOrders))
                  : '—'
              }
            />
          </View>
        ) : null}

        <Text style={styles.footnote}>
          Revenue counts paid, shipped and delivered orders — money that arrived
          and stayed.
        </Text>
      </ScrollView>
    </>
  );
}

function periodComparisonLabel(period: PeriodValue): string {
  if (period === 'week') return 'last week';
  if (period === 'month') return 'last month';
  return '';
}

function PeriodChips({
  value,
  onChange,
  disabled,
}: {
  value: PeriodValue;
  onChange: (next: PeriodValue) => void;
  disabled: boolean;
}) {
  return (
    <View style={styles.periodRow}>
      {PERIODS.map((option) => {
        const active = option.value === value && !disabled;
        return (
          <Pressable
            key={option.value}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active, disabled }}
            style={[styles.periodChip, active && styles.periodChipActive]}
          >
            <Text
              style={[styles.periodText, active && styles.periodTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One figure, with its change against the previous window.
 *
 * The delta renders only when the server sent one. `all time` has no comparison
 * window and a brand new store has no history — printing "0%" in either case
 * would be inventing a fact.
 */
function Metric({
  label,
  value,
  delta,
  comparison,
  tone,
}: {
  label: string;
  value: string;
  delta?: number | null;
  comparison?: string;
  tone?: 'warn';
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <View style={[styles.metric, tone === 'warn' && styles.metricWarn]}>
      <Text style={styles.metricLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {delta !== null && delta !== undefined && comparison ? (
        <View style={styles.deltaRow}>
          <Ionicons
            name={up ? 'arrow-up' : 'arrow-down'}
            size={12}
            color={up ? color.success : color.danger}
          />
          <Text
            style={[
              styles.deltaText,
              { color: up ? color.success : color.danger },
            ]}
          >
            {Math.abs(delta)}% from {comparison}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  tabs: {
    flexDirection: 'row',
    backgroundColor: color.primary50,
    borderRadius: radius.md,
    padding: 4,
  },
  tab: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  tabActive: { backgroundColor: color.surface },
  tabText: { ...text.small, color: color.body, fontFamily: font.medium },
  tabTextActive: { color: color.primary700, fontFamily: font.semibold },

  filters: { gap: space.sm },
  dimmed: { opacity: 0.45 },
  periodRow: { flexDirection: 'row', gap: space.sm },
  periodChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  periodChipActive: {
    backgroundColor: color.primary700,
    borderColor: color.primary700,
  },
  periodText: { ...text.small, color: color.body },
  periodTextActive: { color: '#FFFFFF', fontFamily: font.semibold },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  metric: {
    flexGrow: 1,
    flexBasis: '44%',
    gap: 2,
    backgroundColor: color.sunk,
    borderRadius: radius.md,
    padding: space.lg,
  },
  metricWarn: { backgroundColor: color.warningBg },
  metricLabel: { ...text.small, color: color.body },
  metricValue: { ...text.title, color: color.ink, marginTop: space.xs },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  deltaText: { ...text.small, fontSize: 12 },
  footnote: { ...text.small, color: color.muted },
});
