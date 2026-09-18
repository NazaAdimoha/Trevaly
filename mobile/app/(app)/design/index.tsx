import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PAGE_KEYS, type PageKey } from '@core/storefront/registry';
import {
  DENSITIES,
  type Density,
  PRESET_OPTIONS,
  type PresetKey,
} from '@core/storefront/tokens';

import { PublishBar } from '@/design/publish-bar';
import { useActiveStore } from '@/store/active-store';
import {
  loadDesign,
  setPreset,
  setTokens,
  useDesign,
} from '@/store/design';
import { color, radius, space, text } from '@/theme';
import { ErrorState, Loading } from '@/ui';
import { ColorField } from '@/ui/fields';

const PAGE_LABEL: Record<PageKey, string> = {
  home: 'Home page',
  product: 'Product pages',
  collection: 'Collection pages',
};

const DENSITY_LABEL: Record<Density, string> = {
  compact: 'Compact',
  balanced: 'Balanced',
  roomy: 'Roomy',
};

/**
 * Design — the merchant's storefront, editable from the phone.
 *
 * This screen is the answer to "our stores look basic": a merchant with no
 * laptop can now change the whole look of their shop from the same phone they
 * photograph products with, and see it live within a tap.
 *
 * Appearance first, because a preset changes more about how a shop reads than
 * any section will — typeface, colour, corner radius, image crop and spacing
 * all move together. Then the pages, because that is the slower work.
 */
export default function DesignScreen() {
  const router = useRouter();
  const { slug } = useActiveStore();
  const design = useDesign();

  // Deliberately reloaded every time Design is opened rather than cached. A
  // stale layout carries a stale version, and the first save would then be
  // refused over work the merchant cannot see.
  useEffect(() => {
    if (slug) void loadDesign(slug);
  }, [slug]);

  if (design.loading || !slug) return <Loading />;
  if (!design.layout) {
    return (
      <ErrorState
        message={design.error ?? 'Could not open the designer.'}
        onRetry={() => void loadDesign(slug)}
      />
    );
  }

  const { layout } = design;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lead}>
          Change how your shop looks. Nothing reaches shoppers until you press
          Publish.
        </Text>

        <Text style={styles.groupTitle}>Look</Text>
        <View style={styles.presets}>
          {PRESET_OPTIONS.map((option) => {
            const active = layout.preset === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setPreset(option.value as PresetKey)}
                accessibilityRole='radio'
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.preset,
                  active && styles.presetActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.presetHead}>
                  <Text style={styles.presetLabel}>{option.label}</Text>
                  {active ? (
                    <Ionicons name='checkmark-circle' size={18} color={color.primary700} />
                  ) : null}
                </View>
                {/* Who it is FOR, not what it looks like. A merchant selling
                    kaftans recognises "fashion, shot on a model" instantly and
                    has no idea what "high-contrast editorial" means. */}
                <Text style={styles.presetNote}>{option.suitedTo}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.groupTitle}>Your colour</Text>
        <View style={styles.block}>
          <ColorField
            value={layout.tokens.accent ?? ''}
            onChange={(accent) => setTokens({ accent: accent || null })}
          />
          {/* Reassurance, because the shop may not show exactly the hex they
              typed. `ensureContrast` nudges the colour along its own hue until
              a label on it is legible — a merchant whose brand is pale yellow
              gets their yellow, not white text nobody can read. */}
          <Text style={styles.note}>
            Used for buttons and highlights. We adjust it slightly if text on it
            would be hard to read.
          </Text>
        </View>

        <Text style={styles.groupTitle}>Spacing</Text>
        <View style={styles.chips}>
          {DENSITIES.map((density) => {
            const active = (layout.tokens.density ?? 'balanced') === density;
            return (
              <Pressable
                key={density}
                onPress={() => setTokens({ density })}
                accessibilityRole='radio'
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {DENSITY_LABEL[density]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.groupTitle}>Pages</Text>
        <View style={styles.card}>
          {PAGE_KEYS.map((page: PageKey, index: number) => {
            const sections = layout.pages[page];
            const shown = sections.filter((s) => s.visible).length;
            return (
              <Pressable
                key={page}
                onPress={() => router.push(`/design/${page}`)}
                accessibilityRole='button'
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && styles.rowDivided,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{PAGE_LABEL[page]}</Text>
                  <Text style={styles.rowNote}>
                    {sections.length === 0
                      ? 'No sections yet'
                      : `${shown} of ${sections.length} showing`}
                  </Text>
                </View>
                <Ionicons name='chevron-forward' size={17} color={color.muted} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.groupTitle}>Store front</Text>
        <View style={styles.card}>
          <Toggle
            label='Announcement bar'
            note='The strip above your header'
            value={layout.announcement.enabled}
            page='home'
          />
        </View>

        {design.publishedAt ? (
          <Text style={styles.footnote}>
            Last published {new Date(design.publishedAt).toLocaleString()}
          </Text>
        ) : (
          <Text style={styles.footnote}>
            This design has never been published — shoppers are seeing your
            store&apos;s original look.
          </Text>
        )}
      </ScrollView>

      <PublishBar />
    </View>
  );
}

/**
 * A read-only summary row for the chrome, for now.
 *
 * The announcement bar, header, footer and phone tab bar are all editable
 * through the same registry machinery, but they are not sections and need their
 * own screen. Showing the state without pretending it is editable is the honest
 * intermediate step; a control that does nothing is worse than none.
 */
function Toggle({
  label,
  note,
  value,
}: {
  label: string;
  note: string;
  value: boolean;
  page: string;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowNote}>{note}</Text>
      </View>
      <Text style={[styles.state, value && styles.stateOn]}>
        {value ? 'On' : 'Off'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { padding: space.lg, paddingBottom: space.xxl },
  lead: { ...text.body, color: color.body, marginBottom: space.xl },

  groupTitle: {
    ...text.label,
    color: color.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },

  presets: { gap: space.sm, marginBottom: space.xl },
  preset: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
  },
  presetActive: { borderColor: color.primary, backgroundColor: color.primary50 },
  presetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  presetLabel: { ...text.body, color: color.ink, fontWeight: '600' },
  presetNote: { ...text.small, color: color.muted, marginTop: space.xs },

  block: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.xl,
  },
  note: { ...text.small, color: color.muted },

  chips: { flexDirection: 'row', gap: space.sm, marginBottom: space.xl },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  chipActive: { backgroundColor: color.forest900, borderColor: color.forest900 },
  chipText: { ...text.small, color: color.body },
  chipTextActive: { color: '#FFFFFF' },

  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.line,
    marginBottom: space.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: color.lineSoft },
  rowText: { flex: 1 },
  rowLabel: { ...text.body, color: color.ink },
  rowNote: { ...text.small, color: color.muted, marginTop: 2 },
  state: { ...text.small, color: color.muted },
  stateOn: { color: color.success },

  footnote: { ...text.small, color: color.muted },
  pressed: { opacity: 0.85 },
});
