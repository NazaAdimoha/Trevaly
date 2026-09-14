import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { HIT, color, font, radius, shadow, space, text } from '@/theme';

/** Screen-level states. Every list screen uses these three rather than its own. */
export function Loading() {
  return (
    <View style={styles.centre}>
      <ActivityIndicator color={color.primary700} />
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.centre}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} tone="outline" />
      ) : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

/**
 * "This is old" — shown when the network refresh failed but cached data is on
 * screen.
 *
 * The alternative to this banner is a screen that silently lies: yesterday's
 * order count rendered as though it were current, which is worse than an empty
 * state because the merchant acts on it. Warning tone rather than danger — the
 * app is working, the data is just behind.
 */
export function StaleNotice({ updatedAt }: { updatedAt: number | null }) {
  return (
    <View style={styles.stale}>
      <Ionicons name="cloud-offline-outline" size={16} color={color.warning} />
      <Text style={styles.staleText}>
        {updatedAt
          ? `Offline — showing data from ${relativeTime(updatedAt)}. Pull to retry.`
          : 'Offline — showing saved data. Pull to retry.'}
      </Text>
    </View>
  );
}

/** Coarse on purpose: the merchant needs "is this current", not a timestamp. */
function relativeTime(at: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - at) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

export function Card({
  children,
  style,
  elevated = false,
}: {
  children: ReactNode;
  style?: object;
  /** Lifts the card off the page. The border softens to match — a hard outline
   *  under a shadow reads as a sticker, because real edges lose contrast as
   *  they leave the surface. */
  elevated?: boolean;
}) {
  return (
    <View
      style={[styles.card, elevated && styles.cardElevated, style]}
    >
      {children}
    </View>
  );
}

/**
 * The merchant's mark: their logo, or their initials when they have not
 * uploaded one.
 *
 * The monogram is the common case, not the fallback — most stores never upload
 * a logo — so it is designed rather than merely handled: a gradient tile in the
 * brand greens, which also gives the header something with depth to anchor it.
 *
 * `logoUrl` is a full remote URL on an arbitrary host, so a broken or slow image
 * is expected. `onError` swaps back to the monogram; without it a dead link
 * leaves a grey box where the merchant's identity should be.
 */
export function StoreAvatar({
  name,
  logoUrl,
  size = 52,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const radiusFor = size * 0.3;

  if (logoUrl && !failed) {
    return (
      <View style={[styles.avatarWrap, { width: size, height: size, borderRadius: radiusFor }]}>
        <Image
          source={{ uri: logoUrl }}
          onError={() => setFailed(true)}
          resizeMode="cover"
          accessibilityLabel={`${name} logo`}
          style={{ width: size, height: size, borderRadius: radiusFor }}
        />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={[color.primary400, color.primary700]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.avatarWrap,
        styles.avatarMono,
        { width: size, height: size, borderRadius: radiusFor },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {initialsOf(name)}
      </Text>
    </LinearGradient>
  );
}

/** Up to two letters: "Adaobi Fashion Store" -> "AF". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

/**
 * Status pill. Colour AND text, never colour alone — a merchant checking orders
 * one-handed in a shop should read state at a glance, and one in eight men
 * cannot rely on the hue.
 */
export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? {
    fg: color.body,
    bg: color.sunk,
  };
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.pillText, { color: tone.fg }]}>
        {status.charAt(0) + status.slice(1).toLowerCase()}
      </Text>
    </View>
  );
}

const STATUS_TONE: Record<string, { fg: string; bg: string }> = {
  PAID: { fg: color.success, bg: color.successBg },
  DELIVERED: { fg: color.success, bg: color.successBg },
  SHIPPED: { fg: color.info, bg: color.infoBg },
  PENDING: { fg: color.warning, bg: color.warningBg },
  CANCELLED: { fg: color.danger, bg: color.dangerBg },
  REFUNDED: { fg: color.danger, bg: color.dangerBg },
};

export function Button({
  label,
  onPress,
  tone = 'primary',
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'outline' | 'dark';
  disabled?: boolean;
  busy?: boolean;
}) {
  const palette = {
    primary: { bg: color.primary, border: color.primary, fg: '#FFFFFF' },
    outline: { bg: color.surface, border: color.line, fg: color.ink },
    dark: { bg: color.forest900, border: color.forest900, fg: '#FFFFFF' },
  }[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || busy) }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          opacity: disabled || busy ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Money({ kobo, style }: { kobo: number; style?: object }) {
  return <Text style={[styles.money, style]}>{formatNaira(kobo)}</Text>;
}

/**
 * Formatting is shared with the web app through `@core/money` at every call
 * site that matters; this local helper exists only because React Native's
 * Hermes engine ships a reduced ICU and `Intl.NumberFormat` with a currency
 * style is not dependable across Android versions.
 */
export function formatNaira(kobo: number): string {
  const naira = kobo / 100;
  const [whole, fraction = '00'] = naira.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${grouped}.${fraction}`;
}

const styles = StyleSheet.create({
  stale: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: color.warningBg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  staleText: { ...text.small, color: color.warning, flex: 1 },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.md,
  },
  errorText: {
    ...text.body,
    color: color.body,
    textAlign: 'center',
  },
  emptyTitle: { ...text.heading, color: color.ink, textAlign: 'center' },
  emptyBody: {
    ...text.small,
    color: color.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    padding: space.lg,
  },
  cardElevated: { borderColor: color.lineSoft, ...shadow.raised },
  avatarWrap: {
    overflow: 'hidden',
    backgroundColor: color.sunk,
    ...shadow.raised,
  },
  avatarMono: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: font.bold, letterSpacing: 0.5 },
  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontFamily: font.semibold },
  button: {
    minHeight: HIT,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  buttonText: { fontSize: 16, fontFamily: font.medium },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, fontSize: 15, color: color.ink, paddingVertical: 0 },

  chipRow: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  chipActive: { backgroundColor: color.primary700, borderColor: color.primary700 },
  chipText: { ...text.small, color: color.body, fontFamily: font.medium },
  chipTextActive: { color: '#FFFFFF', fontFamily: font.semibold },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.primary50,
    marginBottom: space.lg,
  },
  emptyAction: { marginTop: space.xl, alignSelf: 'stretch', paddingHorizontal: space.xl },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: color.primary50,
    borderRadius: radius.md,
    padding: space.lg,
  },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { ...text.small, color: color.ink, fontFamily: font.semibold },
  bannerBody: { ...text.small, color: color.body, lineHeight: 19 },

  statTile: {
    flexGrow: 1,
    flexBasis: '22%',
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    alignItems: 'center',
  },
  statTileValue: {
    fontSize: 22,
    fontFamily: font.bold,
    color: color.ink,
    fontVariant: ['tabular-nums'],
  },
  statTileLabel: {
    ...text.small,
    fontSize: 11,
    color: color.body,
    textAlign: 'center',
    marginTop: 2,
  },

  quickAction: {
    flexGrow: 1,
    flexBasis: '22%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.xs,
  },
  quickActionPressed: { backgroundColor: color.sunk },
  quickActionLabel: {
    ...text.small,
    fontSize: 11,
    fontFamily: font.medium,
    color: color.ink,
    textAlign: 'center',
  },

  group: { gap: space.sm },
  groupTitle: {
    ...text.label,
    color: color.muted,
    textTransform: 'uppercase',
    paddingHorizontal: space.xs,
  },
  groupCard: {
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingHorizontal: space.lg,
  },
  settingsRowDivided: { borderTopWidth: 1, borderTopColor: color.lineSoft },
  settingsRowPressed: { backgroundColor: color.sunk },
  settingsLabel: { ...text.body, color: color.ink, flex: 1 },
  badgeWeb: {
    backgroundColor: color.sunk,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  badgeWebText: { ...text.small, fontSize: 10, color: color.muted },
  badge: {
    backgroundColor: color.dangerBg,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  badgeText: { ...text.small, fontSize: 10, fontFamily: font.bold, color: color.danger },

  money: { ...text.body, color: color.ink, fontVariant: ['tabular-nums'] },
});

/* ── Patterns taken from the Bumpa teardown ───────────────────────────────
   See product-research/FINDINGS.md for what each of these is answering. */

/**
 * Search field.
 *
 * Every list in the reference app has one and none of ours did — which is fine
 * at seven products and useless at two hundred, and a merchant who has just
 * bulk-imported a spreadsheet is immediately in the second case.
 *
 * Filters in memory rather than round-tripping: the list is already loaded, the
 * merchant is often on one bar of signal, and a request per keystroke would be
 * slower and sometimes fail.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.searchWrap}>
      <Ionicons name='search' size={17} color={color.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={color.muted}
        autoCapitalize='none'
        autoCorrect={false}
        returnKeyType='search'
        clearButtonMode='while-editing'
        style={styles.searchInput}
      />
    </View>
  );
}

/**
 * A row of status filters.
 *
 * Filled when active, outlined when not. The reference app fills the active
 * chip and it is the right call — an outlined-vs-outlined distinction carried
 * only by text colour is invisible at a glance in daylight, which is where this
 * app is used.
 */
export function FilterChips<T extends string | null>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ label: string; value: T; count?: number }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps='handled'
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.label}
            onPress={() => onChange(option.value)}
            accessibilityRole='button'
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {option.label}
              {option.count !== undefined ? ` (${option.count})` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * An empty state that offers a way out.
 *
 * The reference app never leaves a blank screen without an action, and the
 * difference matters most on first run: a new merchant who opens Orders sees
 * either "Nothing here yet" or a button that starts their first sale.
 */
export function EmptyStateAction({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.centre}>
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={30} color={color.primary700} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {actionLabel && onAction ? (
        <View style={styles.emptyAction}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * A dismissible tip.
 *
 * Dismissal is per-viewer and not persisted: these announce something new, and
 * a banner that silently never returns is worse than one shown twice.
 */
export function InfoBanner({
  icon = 'information-circle',
  title,
  body,
  onDismiss,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  onDismiss?: () => void;
}) {
  return (
    <View style={styles.banner}>
      <Ionicons name={icon} size={20} color={color.primary700} />
      <View style={styles.bannerText}>
        <Text style={styles.bannerTitle}>{title}</Text>
        <Text style={styles.bannerBody}>{body}</Text>
      </View>
      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole='button'
          accessibilityLabel='Dismiss'
        >
          <Ionicons name='close' size={18} color={color.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const TILE_TONES = {
  green: { bg: color.successBg, fg: color.success },
  blue: { bg: color.infoBg, fg: color.info },
  amber: { bg: color.warningBg, fg: color.warning },
  rose: { bg: color.dangerBg, fg: color.danger },
} as const;

/**
 * A pastel stat tile.
 *
 * The tint is the label's, not the number's: four white cards make the reader
 * find each heading to know what they are looking at, whereas four colours are
 * recognised without reading. The figure stays ink so it remains the most
 * legible thing in the tile.
 */
export function StatTile({
  tone,
  value,
  label,
}: {
  tone: keyof typeof TILE_TONES;
  value: number | string;
  label: string;
}) {
  return (
    <View style={[styles.statTile, { backgroundColor: TILE_TONES[tone].bg }]}>
      <Text style={styles.statTileValue}>{value}</Text>
      <Text style={styles.statTileLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/**
 * A square action button, four to a row.
 *
 * These are the things a merchant opens the app to DO, as opposed to the
 * numbers they open it to see — so they sit above the fold, not behind a tab.
 */
export function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      style={({ pressed }) => [styles.quickAction, pressed && styles.quickActionPressed]}
    >
      <Ionicons name={icon} size={22} color={color.primary700} />
      <Text style={styles.quickActionLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A settings group: uppercase caption over a card of rows. */
export function SettingsGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

/** One row inside a `SettingsGroup`. */
export function SettingsRow({
  icon,
  label,
  badge,
  web = false,
  danger = false,
  first = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  /** Marks a row that opens the web dashboard rather than a screen in here. */
  web?: boolean;
  danger?: boolean;
  first?: boolean;
  onPress: () => void;
}) {
  const tint = danger ? color.danger : color.primary700;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='button'
      style={({ pressed }) => [
        styles.settingsRow,
        !first && styles.settingsRowDivided,
        pressed && styles.settingsRowPressed,
      ]}
    >
      <Ionicons name={icon} size={20} color={tint} />
      <Text style={[styles.settingsLabel, danger && { color: color.danger }]}>
        {label}
      </Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      {web ? (
        <View style={styles.badgeWeb}>
          <Text style={styles.badgeWebText}>Web</Text>
        </View>
      ) : null}
      <Ionicons name='chevron-forward' size={17} color={color.muted} />
    </Pressable>
  );
}


/** Date range picker lives in its own file — it pulls in a native module. */
export { type DateRange, DateRangeChip, formatRange } from './range';
