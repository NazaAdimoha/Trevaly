import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { OrderStatus } from '@core/enums';
import { nextStatuses, ORDER_ACTION_LABEL } from '@core/orders';

import { api, toApiError } from '@/api/client';
import { useQuery } from '@/api/hooks';
import { orderDetailSchema } from '@/api/schemas';
import { useActiveStore } from '@/store/active-store';
import { color, font, space, text } from '@/theme';
import { Button, Card, ErrorState, Loading, Money, StatusPill } from '@/ui';

/**
 * One order, and the two things a merchant does with it: read it out to a
 * customer, and move it along.
 *
 * The action buttons come from the same transition table the server enforces,
 * so the app can never offer a move the API will refuse. A destructive move —
 * cancelling or refunding — asks first; marking something shipped does not,
 * because that is the common case and a confirmation on every tap is friction
 * on the one flow this app exists for.
 */
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { slug } = useActiveStore();
  const [busy, setBusy] = useState<string | null>(null);

  const order = useQuery(
    slug && id ? `/stores/${slug}/orders/${id}` : null,
    orderDetailSchema,
    [slug, id],
  );

  const move = async (status: OrderStatus) => {
    if (!slug || !id) return;
    setBusy(status);
    try {
      await api.patch(`/stores/${slug}/orders/${id}`, { status });
      await order.refresh();
    } catch (err) {
      Alert.alert('Could not update', toApiError(err).message);
    } finally {
      setBusy(null);
    }
  };

  const confirmMove = (status: OrderStatus) => {
    const destructive = status === 'CANCELLED' || status === 'REFUNDED';
    if (!destructive) {
      void move(status);
      return;
    }
    Alert.alert(
      ORDER_ACTION_LABEL[status],
      'This cannot be undone. The customer has already paid.',
      [
        { text: 'Back', style: 'cancel' },
        {
          text: ORDER_ACTION_LABEL[status],
          style: 'destructive',
          onPress: () => void move(status),
        },
      ],
    );
  };

  if (order.loading) return <Loading />;
  if (order.error) {
    return <ErrorState message={order.error.message} onRetry={order.refresh} />;
  }
  if (!order.data) return null;

  const data = order.data;
  const moves = nextStatuses(data.status);

  return (
    <ScrollView
      contentContainerStyle={styles.page}
      refreshControl={
        <RefreshControl refreshing={order.refreshing} onRefresh={order.refresh} />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.orderNumber}>#{data.orderNumber}</Text>
        <StatusPill status={data.status} />
      </View>

      {data.hasStockIssue ? (
        <Card style={styles.warning}>
          <Text style={styles.warningTitle}>Stock ran out after payment</Text>
          <Text style={styles.warningBody}>
            {data.internalNote ??
              'This order is paid but could not be stocked. Refund or send a replacement.'}
          </Text>
        </Card>
      ) : null}

      {/* A chargeback is the most urgent thing that can happen to an order and
          it used to be invisible here — the money is being pulled back and the
          merchant has a deadline to respond. Danger tone, above everything
          except a stock failure, and it stays on screen after the dispute
          resolves because "this customer disputed before" is what you want to
          know the next time they order. */}
      {data.disputedAt ? (
        <Card style={styles.danger}>
          <View style={styles.dangerHead}>
            <Ionicons name="alert-circle" size={20} color={color.danger} />
            <Text style={styles.dangerTitle}>
              {data.disputeStatus === 'resolved'
                ? 'Chargeback resolved'
                : 'Chargeback raised'}
            </Text>
          </View>
          <Text style={styles.warningBody}>
            {data.disputeReason ?? 'The customer disputed this payment.'}
            {data.disputeStatus && data.disputeStatus !== 'resolved'
              ? ' Respond in your Paystack dashboard.'
              : ''}
          </Text>
        </Card>
      ) : null}

      {data.refundedAmountKobo ? (
        <Card style={styles.warning}>
          <View style={styles.dangerHead}>
            <Ionicons name="arrow-undo" size={19} color={color.warning} />
            <Text style={styles.warningTitle}>
              {data.status === 'REFUNDED' ? 'Refunded' : 'Partly refunded'}
            </Text>
          </View>
          <Text style={styles.warningBody}>
            <Money kobo={data.refundedAmountKobo} /> returned to the customer.
            {data.status === 'REFUNDED'
              ? ''
              : ' The rest of this order is still paid.'}
            {' Stock was not added back — adjust it if the item came back.'}
          </Text>
        </Card>
      ) : null}

      {data.paymentFailedAt && data.status === 'PENDING' ? (
        <Card style={styles.warning}>
          <View style={styles.dangerHead}>
            <Ionicons name="card-outline" size={19} color={color.warning} />
            <Text style={styles.warningTitle}>Payment failed</Text>
          </View>
          <Text style={styles.warningBody}>
            {data.paymentFailureReason ?? 'The payment did not go through.'}
            {' The customer can still pay — this order has not been cancelled.'}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.sectionLabel}>Customer</Text>
        <Text style={styles.customerName}>{data.customerName}</Text>
        <Text selectable style={styles.contact}>{data.customerPhone}</Text>
        <Text selectable style={styles.contact}>{data.customerEmail}</Text>
        {data.deliveryAddress ? (
          <>
            <Text style={[styles.sectionLabel, styles.spaced]}>Deliver to</Text>
            <Text selectable style={styles.contact}>{data.deliveryAddress}</Text>
          </>
        ) : (
          <Text style={[styles.contact, styles.spaced]}>Collecting in store</Text>
        )}
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Items</Text>
        {data.items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.itemMain}>
              <Text style={styles.itemName}>{item.productName}</Text>
              {item.variantLabel ? (
                <Text style={styles.itemVariant}>{item.variantLabel}</Text>
              ) : null}
              <Text style={styles.itemQty}>Qty {item.quantity}</Text>
            </View>
            <Money kobo={item.unitPriceKobo * item.quantity} />
          </View>
        ))}

        <View style={styles.totals}>
          <Row label="Subtotal" kobo={data.subtotalKobo} />
          {data.deliveryFeeKobo > 0 ? (
            <Row label="Delivery" kobo={data.deliveryFeeKobo} />
          ) : null}
          {data.discountKobo > 0 ? (
            <Row label="Discount" kobo={-data.discountKobo} />
          ) : null}
          <View style={styles.grandTotal}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Money kobo={data.totalKobo} style={styles.grandTotalValue} />
          </View>
        </View>
      </Card>

      {moves.length > 0 ? (
        <View style={styles.actions}>
          {moves.map((status) => (
            <Button
              key={status}
              label={ORDER_ACTION_LABEL[status]}
              tone={status === 'CANCELLED' || status === 'REFUNDED' ? 'outline' : 'primary'}
              busy={busy === status}
              disabled={busy !== null && busy !== status}
              onPress={() => confirmMove(status)}
            />
          ))}
        </View>
      ) : (
        <Text style={styles.terminal}>This order is closed.</Text>
      )}
    </ScrollView>
  );
}

function Row({ label, kobo }: { label: string; kobo: number }) {
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Money kobo={kobo} style={styles.totalValue} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  orderNumber: { ...text.display, color: color.ink, fontVariant: ['tabular-nums'] },
  warning: { backgroundColor: color.warningBg, borderColor: color.warning, gap: space.xs },
  danger: { backgroundColor: color.dangerBg, gap: space.sm },
  dangerHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dangerTitle: { ...text.heading, color: color.danger },
  warningTitle: { ...text.heading, color: color.ink },
  warningBody: { ...text.small, color: color.body },
  sectionLabel: {
    ...text.label,
    color: color.muted,
    textTransform: 'uppercase',
    marginBottom: space.sm,
  },
  spaced: { marginTop: space.lg },
  customerName: { ...text.heading, color: color.ink },
  contact: { ...text.body, color: color.body, marginTop: 2 },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
    gap: space.md,
  },
  itemMain: { flex: 1 },
  itemName: { ...text.body, color: color.ink, fontFamily: font.medium },
  itemVariant: { ...text.small, color: color.primary700, marginTop: 2 },
  itemQty: { ...text.small, color: color.muted, marginTop: 2 },
  totals: { marginTop: space.md, gap: space.xs },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { ...text.small, color: color.body },
  totalValue: { ...text.small, color: color.body },
  grandTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: color.lineSoft,
    paddingTop: space.md,
    marginTop: space.xs,
  },
  grandTotalLabel: { ...text.heading, color: color.ink },
  grandTotalValue: { ...text.heading, color: color.ink },
  actions: { gap: space.sm, marginTop: space.sm },
  terminal: { ...text.small, color: color.muted, textAlign: 'center', marginTop: space.lg },
});
