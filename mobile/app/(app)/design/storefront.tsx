import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toMajor, toMinor } from '@core/money';
import type { StorefrontLayout } from '@core/storefront/layout';

import { PublishBar } from '@/design/publish-bar';
import { setChrome, useDesign } from '@/store/design';
import { color, font, radius, space, text } from '@/theme';
import { Loading } from '@/ui';

/**
 * The parts of a storefront that sit around every page.
 *
 * These were read-only state on the Design screen — a merchant could see that
 * their announcement bar was on and had no way to change what it said. The bar
 * is the one thing a shop changes weekly ("free delivery this weekend"), so
 * being the only person who could edit it made me the bottleneck on the most
 * routine thing in the product.
 *
 * Hand-written rather than generated from the registry, which the sections use.
 * The chrome does not fit that model: `messages` is a flat string array where
 * `blocks` wants objects, the menus nest a level deeper than `blocks` renders,
 * and the tab bar is a multi-select the field types have no equivalent for.
 * Bending the registry around four one-off shapes would have cost more than
 * writing them.
 *
 * Two settings are deliberately absent. `showAccount` and `showCurrency` are in
 * the schema and are rendered by nothing — there are no customer accounts and no
 * currency switcher — so a toggle for either would be a control that does
 * nothing, which is worse than its absence.
 */
const TABS: { key: 'home' | 'menu' | 'search' | 'shop' | 'cart'; label: string }[] = [
  { key: 'home', label: 'Home' },
  { key: 'menu', label: 'Menu' },
  { key: 'search', label: 'Search' },
  { key: 'shop', label: 'Shop' },
  { key: 'cart', label: 'Cart' },
];

const SOCIALS: StorefrontLayout['footer']['socials'][number]['platform'][] = [
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'youtube',
  'whatsapp',
];

const HEADER_LAYOUTS: {
  key: StorefrontLayout['header']['layout'];
  label: string;
  note: string;
}[] = [
  { key: 'classic', label: 'Classic', note: 'Logo left, menu beside it' },
  { key: 'centred', label: 'Centred', note: 'Logo in the middle' },
  { key: 'floating', label: 'Floating', note: 'A pill over your hero' },
];

export default function StorefrontChromeScreen() {
  const design = useDesign();
  if (!design.layout) return <Loading />;

  const { announcement, header, footer, mobileBar } = design.layout;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Store front' }} />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Group title="Announcement bar" note="The strip above your header.">
            <Toggle
              label="Show it"
              value={announcement.enabled}
              onChange={(enabled) => setChrome('announcement', { enabled })}
            />

            {announcement.enabled ? (
              <>
                <StringList
                  label="Messages"
                  hint="More than one and they rotate."
                  values={announcement.messages}
                  max={5}
                  placeholder="Free delivery on orders over ₦50,000"
                  onChange={(messages) => setChrome('announcement', { messages })}
                />

                <Line
                  label="Tapping it goes to"
                  hint="Optional. A collection, or a product."
                  value={announcement.href ?? ''}
                  placeholder="/products"
                  onChange={(href) => setChrome('announcement', { href: href || null })}
                />

                <Toggle
                  label="Shoppers can dismiss it"
                  value={announcement.dismissible}
                  onChange={(dismissible) => setChrome('announcement', { dismissible })}
                />

                <Naira
                  label="Free delivery over"
                  hint="Shows a shopper how close they are, in the cart. Leave empty for none."
                  kobo={announcement.freeShippingThresholdKobo ?? null}
                  onChange={(freeShippingThresholdKobo) =>
                    setChrome('announcement', { freeShippingThresholdKobo })
                  }
                />
              </>
            ) : null}
          </Group>

          <Group title="Header">
            <Text style={styles.label}>Layout</Text>
            <View style={styles.cards}>
              {HEADER_LAYOUTS.map((option) => {
                const active = header.layout === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setChrome('header', { layout: option.key })}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.card,
                      active && styles.cardActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.cardHead}>
                      <Text style={styles.cardLabel}>{option.label}</Text>
                      {active ? (
                        <Ionicons name="checkmark-circle" size={18} color={color.primary700} />
                      ) : null}
                    </View>
                    <Text style={styles.hint}>{option.note}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Toggle
              label="Stays on screen as you scroll"
              value={header.sticky}
              onChange={(sticky) => setChrome('header', { sticky })}
            />
            <Toggle
              label="See-through over the hero"
              hint="Only looks right on a page that starts with a hero image."
              value={header.transparentOverHero}
              onChange={(transparentOverHero) =>
                setChrome('header', { transparentOverHero })
              }
            />
            <Toggle
              label="Show search"
              value={header.showSearch}
              onChange={(showSearch) => setChrome('header', { showSearch })}
            />
          </Group>

          <Group title="Footer">
            <Toggle
              label="Email sign-up"
              value={footer.newsletter}
              onChange={(newsletter) => setChrome('footer', { newsletter })}
            />
            {footer.newsletter ? (
              <>
                <Line
                  label="Heading"
                  value={footer.newsletterHeading}
                  placeholder="Stay in the loop"
                  onChange={(newsletterHeading) => setChrome('footer', { newsletterHeading })}
                />
                <Line
                  label="Supporting line"
                  value={footer.newsletterBody}
                  placeholder="Early access to new arrivals, and nothing else."
                  multiline
                  onChange={(newsletterBody) => setChrome('footer', { newsletterBody })}
                />
              </>
            ) : null}

            <Toggle
              label="Big wordmark at the bottom"
              value={footer.wordmark}
              onChange={(wordmark) => setChrome('footer', { wordmark })}
            />
            <Toggle
              label="Show payment icons"
              value={footer.showPaymentIcons}
              onChange={(showPaymentIcons) => setChrome('footer', { showPaymentIcons })}
            />

            <Socials
              value={footer.socials}
              onChange={(socials) => setChrome('footer', { socials })}
            />
          </Group>

          <Group title="Phone tab bar" note="The row pinned to the bottom on a phone.">
            <Toggle
              label="Show it"
              value={mobileBar.enabled}
              onChange={(enabled) => setChrome('mobileBar', { enabled })}
            />
            {mobileBar.enabled ? (
              <>
                <Text style={styles.label}>Tabs</Text>
                <Text style={styles.hint}>
                  Four is the most that stays readable on a small screen.
                </Text>
                <View style={styles.chips}>
                  {TABS.map((tab) => {
                    const on = mobileBar.items.includes(tab.key);
                    const last = on && mobileBar.items.length <= 1;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={() =>
                          setChrome('mobileBar', {
                            items: on
                              ? mobileBar.items.filter((item) => item !== tab.key)
                              : [...mobileBar.items, tab.key].slice(0, 5),
                          })
                        }
                        // The last tab cannot be removed: an enabled bar with
                        // nothing in it renders as a blank strip across the
                        // bottom of every page.
                        disabled={last}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on, disabled: last }}
                        style={({ pressed }) => [
                          styles.chip,
                          on && styles.chipActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.chipText, on && styles.chipTextActive]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </Group>

          <Text style={styles.footnote}>
            Your menu comes from your categories. A custom menu is a web job for
            now.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <PublishBar />
    </View>
  );
}

/* ─── Pieces ──────────────────────────────────────────────────────────────── */

function Group({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {note ? <Text style={styles.hint}>{note}</Text> : null}
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: color.primary, false: color.line }}
      />
    </View>
  );
}

/**
 * Text committed on blur.
 *
 * The draft is a module-level store every Design screen subscribes to, so
 * writing on each keystroke re-renders this screen and the publish bar with it.
 */
function Line({
  label,
  hint,
  value,
  placeholder,
  multiline,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);
  if (!focused && draft !== value) setDraft(value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          onChange(draft);
        }}
        placeholder={placeholder}
        placeholderTextColor={color.muted}
        multiline={multiline}
        autoCapitalize="sentences"
        style={[styles.input, multiline && styles.multiline]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/** Naira in, kobo out. Money is integer kobo everywhere it is stored. */
function Naira({
  label,
  hint,
  kobo,
  onChange,
}: {
  label: string;
  hint?: string;
  kobo: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <Line
      label={label}
      hint={hint}
      value={kobo === null ? '' : String(toMajor(kobo))}
      placeholder="50000"
      onChange={(raw) => {
        const digits = raw.replace(/[^\d.]/g, '');
        if (!digits) return onChange(null);
        const value = Number(digits);
        onChange(Number.isFinite(value) && value > 0 ? toMinor(value) : null);
      }}
    />
  );
}

/** A flat list of strings — the announcement bar's rotating messages. */
function StringList({
  label,
  hint,
  values,
  max,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  values: string[];
  max: number;
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      {values.map((value, index) => (
        <View key={index} style={styles.listRow}>
          <View style={styles.listInput}>
            <Line
              label=""
              value={value}
              placeholder={placeholder}
              onChange={(next) =>
                onChange(values.map((item, i) => (i === index ? next : item)))
              }
            />
          </View>
          <Pressable
            onPress={() => onChange(values.filter((_, i) => i !== index))}
            accessibilityRole="button"
            accessibilityLabel={`Remove message ${index + 1}`}
            hitSlop={8}
            style={styles.listRemove}
          >
            <Ionicons name="trash-outline" size={18} color={color.danger} />
          </Pressable>
        </View>
      ))}

      {values.length < max ? (
        <Pressable
          onPress={() => onChange([...values, ''])}
          accessibilityRole="button"
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={16} color={color.primary700} />
          <Text style={styles.addText}>Add a message</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Socials({
  value,
  onChange,
}: {
  value: StorefrontLayout['footer']['socials'];
  onChange: (next: StorefrontLayout['footer']['socials']) => void;
}) {
  const used = new Set(value.map((social) => social.platform));

  return (
    <View style={styles.field}>
      <Text style={styles.label}>Social links</Text>

      {value.map((social, index) => (
        <View key={social.platform} style={styles.listRow}>
          <View style={styles.listInput}>
            <Line
              label=""
              value={social.href}
              placeholder={`https://${social.platform}.com/yourshop`}
              onChange={(href) =>
                onChange(value.map((item, i) => (i === index ? { ...item, href } : item)))
              }
            />
            <Text style={styles.hint}>{social.platform}</Text>
          </View>
          <Pressable
            onPress={() => onChange(value.filter((_, i) => i !== index))}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${social.platform}`}
            hitSlop={8}
            style={styles.listRemove}
          >
            <Ionicons name="trash-outline" size={18} color={color.danger} />
          </Pressable>
        </View>
      ))}

      <View style={styles.chips}>
        {SOCIALS.filter((platform) => !used.has(platform)).map((platform) => (
          <Pressable
            key={platform}
            onPress={() => onChange([...value, { platform, href: '' }])}
            accessibilityRole="button"
            accessibilityLabel={`Add ${platform}`}
            style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
          >
            <Text style={styles.chipText}>+ {platform}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  fill: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl },

  group: { marginBottom: space.xl },
  groupTitle: {
    ...text.label,
    color: color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.xs,
  },
  groupBody: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    marginTop: space.sm,
  },

  field: { gap: space.xs },
  label: { ...text.small, color: color.ink, fontFamily: font.medium },
  hint: { ...text.small, color: color.muted },
  rowLabel: { ...text.body, color: color.ink },

  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    paddingHorizontal: space.lg,
    fontSize: 16,
    color: color.ink,
  },
  multiline: { minHeight: 84, paddingTop: space.md, textAlignVertical: 'top' },

  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  toggleText: { flex: 1 },

  cards: { gap: space.sm },
  card: {
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    padding: space.md,
    backgroundColor: color.surface,
  },
  cardActive: { borderColor: color.primary, backgroundColor: color.primary50 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { ...text.body, color: color.ink, fontFamily: font.medium },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  chipActive: { backgroundColor: color.forest900, borderColor: color.forest900 },
  chipText: { ...text.small, color: color.body },
  chipTextActive: { color: '#FFFFFF' },

  listRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  listInput: { flex: 1 },
  listRemove: { paddingTop: space.md, paddingHorizontal: space.xs },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 44,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.md,
    marginTop: space.xs,
  },
  addText: { ...text.small, color: color.primary700, fontFamily: font.medium },

  footnote: { ...text.small, color: color.muted, textAlign: 'center' },
  pressed: { opacity: 0.85 },
});
