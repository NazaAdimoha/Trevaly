import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useQuery } from '@/api/hooks';
import { type OrderListItem, orderListSchema } from '@/api/schemas';
import { useActiveStore } from '@/store/active-store';
import { color, font, radius, space, text } from '@/theme';
import {
  EmptyStateAction,
  ErrorState,
  FilterChips,
  formatNaira,
  Loading,
  StaleNotice,
} from '@/ui';

/**
 * Notifications.
 *
 * DERIVED FROM ORDERS, not stored. There is no notification table and adding
 * one is a real piece of work — a `Notification` model, a write on every
 * interesting event, read state per user, and a push pipeline to make it worth
 * having. Everything a merchant needs to be told right now is already a fact
 * about an order: it was paid, it could not be stocked, it was disputed, it was
 * refunded, the payment failed.
 *
 * Deriving means no new schema, nothing to keep in sync, and no possibility of
 * a notification that disagrees with the order it describes. What it cannot do
 * is survive the order being deleted, carry read state, or fire when the app is
 * closed — which is exactly the line where a real table and push become worth
 * building. See MOBILE_PLAN Phase 4.
 */

type Kind = 'attention' | 'dispute' | 'refund' | 'failed' | 'paid';

type Item = {
  id: string;
  orderId: string;
  kind: Kind;
  title: string;
  body: string;
  at: string;
};

const KIND_META: Record<
  Kind,
  { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string }
> = {
  attention: { icon: 'alert-circle', fg: color.warning, bg: color.warningBg },
  dispute: { icon: 'shield-outline', fg: color.danger, bg: color.dangerBg },
  refund: { icon: 'arrow-undo', fg: color.warning, bg: color.warningBg },
  failed: { icon: 'card-outline', fg: color.danger, bg: color.dangerBg },
  paid: { icon: 'cash-outline', fg: color.success, bg: color.successBg },
};

/**
 * Turn one order into the notifications it deserves.
 *
 * An order can produce more than one — a paid order that was then disputed is
 * two things the merchant needs to know, and collapsing them to the most recent
 * hides the sale behind the problem.
 */
function notificationsFor(order: OrderListItem): Item[] {
  const out: Item[] = [];
  const money = formatNaira(order.totalKobo);

  if (order.hasStockIssue) {
    out.push({
      id: `${order.id}:attention`,
      orderId: order.id,
      kind: 'attention',
      title: `Order #${order.orderNumber} needs attention`,
      body: 'Paid, but stock ran out before it could be packed.',
      at: order.createdAt,
    });
  }

  const withExtras = order as OrderListItem & {
    disputedAt?: string | null;
    disputeStatus?: string | null;
    refundedAmountKobo?: number | null;
    paymentFailedAt?: string | null;
    paymentFailureReason?: string | null;
  };

  if (withExtras.disputedAt) {
    out.push({
      id: `${order.id}:dispute`,
      orderId: order.id,
      kind: 'dispute',
      title: `Chargeback on #${order.orderNumber}`,
      body:
        withExtras.disputeStatus === 'resolved'
          ? 'The dispute has been resolved.'
          : 'Respond in your Paystack dashboard.',
      at: withExtras.disputedAt,
    });
  }

  if (withExtras.refundedAmountKobo) {
    out.push({
      id: `${order.id}:refund`,
      orderId: order.id,
      kind: 'refund',
      title: `Refund on #${order.orderNumber}`,
      body: `${formatNaira(withExtras.refundedAmountKobo)} returned to the customer.`,
      at: order.createdAt,
    });
  }

  if (withExtras.paymentFailedAt && order.status === 'PENDING') {
    out.push({
      id: `${order.id}:failed`,
      orderId: order.id,
      kind: 'failed',
      title: `Payment failed on #${order.orderNumber}`,
      body: withExtras.paymentFailureReason ?? 'The card was declined.',
      at: withExtras.paymentFailedAt,
    });
  }

  if (order.status === 'PAID' && !order.hasStockIssue) {
    out.push({
      id: `${order.id}:paid`,
      orderId: order.id,
      kind: 'paid',
      title: `New order #${order.orderNumber}`,
      body: `${order.customerName} paid ${money}.`,
      at: order.createdAt,
    });
  }

  return out;
}

/** Group by calendar day, newest first — the reference app's shape. */
function groupByDay(items: Item[]): Array<[string, Item[]]> {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 864e5).toDateString();

  const buckets = new Map<string, Item[]>();
  for (const item of items) {
    const day = new Date(item.at).toDateString();
    const label =
      day === today ? 'Today' : day === yesterday ? 'Yesterday' : day;
    buckets.set(label, [...(buckets.get(label) ?? []), item]);
  }
  return [...buckets.entries()];
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();
  const [filter, setFilter] = useState<Kind | null>(null);

  const orders = useQuery(
    slug ? `/stores/${slug}/orders?pageSize=50` : null,
    orderListSchema,
    [slug],
  );

  const all = orders.data?.items ?? [];

  const items = useMemo(() => {
    const derived = all.flatMap(notificationsFor);
    derived.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    return filter ? derived.filter((i) => i.kind === filter) : derived;
  }, [all, filter]);

  const counts = useMemo(() => {
    const derived = all.flatMap(notificationsFor);
    return {
      all: derived.length,
      attention: derived.filter((i) => i.kind === 'attention').length,
      dispute: derived.filter((i) => i.kind === 'dispute').length,
      paid: derived.filter((i) => i.kind === 'paid').length,
    };
  }, [all]);

  if (!slug) {
    return <ErrorState message="Pick a store on the Home tab first." />;
  }
  if (orders.loading && !orders.data) return <Loading />;
  if (orders.error && !orders.data) {
    return <ErrorState message={orders.error.message} onRetry={orders.refresh} />;
  }

  const groups = groupByDay(items);

  return (
    <>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <ScrollView contentContainerStyle={styles.page}>
        {orders.stale ? <StaleNotice updatedAt={orders.updatedAt} /> : null}

        <FilterChips
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'All', value: null, count: counts.all },
            { label: 'Needs action', value: 'attention', count: counts.attention },
            { label: 'Chargebacks', value: 'dispute', count: counts.dispute },
            { label: 'Orders', value: 'paid', count: counts.paid },
          ]}
        />

        {groups.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyStateAction
              icon="notifications-outline"
              title="Nothing to report"
              body="New orders, refunds and anything needing your attention will appear here."
            />
          </View>
        ) : (
          groups.map(([day, dayItems]) => (
            <View key={day} style={styles.group}>
              <Text style={styles.dayLabel}>{day}</Text>
              <View style={styles.groupCard}>
                {dayItems.map((item, index) => {
                  const meta = KIND_META[item.kind];
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => router.push(`/(app)/orders/${item.orderId}`)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.rowDivided,
                        pressed && { backgroundColor: color.sunk },
                      ]}
                    >
                      <View style={[styles.icon, { backgroundColor: meta.bg }]}>
                        <Ionicons name={meta.icon} size={17} color={meta.fg} />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.title}>{item.title}</Text>
                        <Text style={styles.body}>{item.body}</Text>
                      </View>
                      <Text style={styles.time}>{shortTime(item.at)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </>
  );
}

function shortTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl },
  flex: { flex: 1 },
  emptyWrap: { paddingTop: space.xxl },
  group: { gap: space.sm },
  dayLabel: { ...text.label, color: color.muted, textTransform: 'uppercase' },
  groupCard: {
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.lg,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: color.lineSoft },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...text.small, color: color.ink, fontFamily: font.semibold },
  body: { ...text.small, color: color.body, marginTop: 2, lineHeight: 19 },
  time: { ...text.small, fontSize: 12, color: color.muted },
});
