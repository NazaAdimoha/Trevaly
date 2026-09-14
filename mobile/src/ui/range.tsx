import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { color, font, radius, space, text } from '@/theme';

import { Button } from './index';

export type DateRange = { from: Date; to: Date } | null;

/** "30 Aug – 2 Sep" — no year unless the range crosses one. */
export function formatRange(range: DateRange): string {
  if (!range) return 'Custom range';
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const from = range.from.toLocaleDateString(undefined, opts);
  const to = range.to.toLocaleDateString(undefined, {
    ...opts,
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${from} – ${to}`;
}

/**
 * A from/to date range chip with a picker.
 *
 * Both dates are chosen before anything is applied. Firing a request on each
 * half would spend a round trip on a range the merchant has not finished
 * describing, and on a slow connection that shows them a figure for a window
 * they never asked for.
 *
 * The two pickers are stacked in one sheet rather than sequential modals: a
 * merchant correcting the start date should not have to walk through the end
 * date again to get back.
 */
export function DateRangeChip({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (next: DateRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState<Date>(
    value?.from ?? new Date(Date.now() - 7 * 864e5),
  );
  const [to, setTo] = useState<Date>(value?.to ?? new Date());

  const invalid = to < from;

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
      >
        <Ionicons name="calendar-outline" size={14} color={color.body} />
        <Text style={styles.chipText}>{formatRange(value)}</Text>
        {value ? (
          <Pressable
            onPress={() => onChange(null)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Clear date range"
          >
            <Ionicons name="close-circle" size={15} color={color.muted} />
          </Pressable>
        ) : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>Pick a date range</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>From</Text>
            <DateTimePicker
              value={from}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_e, d) => d && setFrom(d)}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>To</Text>
            <DateTimePicker
              value={to}
              mode="date"
              maximumDate={new Date()}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
              onChange={(_e, d) => d && setTo(d)}
            />
          </View>

          {invalid ? (
            <Text style={styles.error} accessibilityRole="alert">
              The end date is before the start date.
            </Text>
          ) : null}

          <Button
            label="Apply"
            disabled={invalid}
            onPress={() => {
              onChange({ from, to });
              setOpen(false);
            }}
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 34,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  chipPressed: { backgroundColor: color.sunk },
  chipText: { ...text.small, color: color.body, fontFamily: font.medium },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,37,24,0.35)' },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.xl,
    gap: space.lg,
    paddingBottom: space.xxl,
  },
  sheetTitle: { ...text.heading, color: color.ink },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  fieldLabel: { ...text.body, color: color.ink },
  error: { ...text.small, color: color.danger },
});
