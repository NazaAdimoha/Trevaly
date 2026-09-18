import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  type Field,
  PAGE_KEYS,
  type PageKey,
  sectionDefinition,
} from '@core/storefront/registry';

import { useAppConfig } from '@/api/config';
import { PublishBar } from '@/design/publish-bar';
import { useActiveStore } from '@/store/active-store';
import { updateSettings, useDesign } from '@/store/design';
import { color, radius, space, text } from '@/theme';
import { EmptyState, Loading } from '@/ui';
import { FieldControl } from '@/ui/fields';

const isPageKey = (value: unknown): value is PageKey =>
  typeof value === 'string' && (PAGE_KEYS as readonly string[]).includes(value);

/**
 * One section's settings, built from the registry.
 *
 * There is no per-section screen anywhere in this app and there never will be.
 * Every control here is produced from the `fields` array on the section's
 * registry entry, which is the same array the API validates against and the
 * same one the web renderer reads. Adding "Countdown bar" ships a web component
 * and a registry entry; this screen edits it with no change and no app release.
 */
export default function SectionScreen() {
  const params = useLocalSearchParams<{ page: string; id: string }>();
  const design = useDesign();
  const { slug } = useActiveStore();
  const config = useAppConfig();

  const page = isPageKey(params.page) ? params.page : 'home';
  const section = design.layout?.pages[page].find((s) => s.id === params.id) ?? null;

  if (!design.layout) return <Loading />;
  if (!section) {
    return (
      <EmptyState
        title='Section not found'
        body='It may have been removed on another device. Go back and pick another.'
      />
    );
  }

  const definition = sectionDefinition(section.type);
  if (!definition) {
    return (
      <EmptyState
        title='Not editable in this version'
        body={`This page uses a "${section.type}" section that this app does not know yet. Update the app to edit it — your shop still shows it correctly.`}
      />
    );
  }

  const settings = section.settings;
  const set = (key: string, value: unknown) =>
    updateSettings(page, section.id, { [key]: value });

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: definition.label }} />

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps='handled'
        >
          <Text style={styles.lead}>{definition.description}</Text>

          {definition.fields.map((field) =>
            field.type === 'blocks' ? (
              <BlockList
                key={field.key}
                field={field}
                value={settings[field.key]}
                onChange={(next) => set(field.key, next)}
                storeSlug={slug ?? ''}
                cloudName={config?.cloudinaryCloudName ?? null}
              />
            ) : (
              <FieldControl
                key={field.key}
                field={field}
                value={settings[field.key]}
                onChange={(next) => set(field.key, next)}
                storeSlug={slug ?? ''}
                cloudName={config?.cloudinaryCloudName ?? null}
              />
            ),
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PublishBar />
    </View>
  );
}

type Block = Record<string, unknown>;

/**
 * A repeatable group — slides, tiles, questions, reviews.
 *
 * Rendered inline rather than behind another navigation push. A merchant
 * writing five FAQ entries should see the five of them, not five screens; the
 * whole reason a phone editor feels slower than a laptop one is depth, and
 * every level removed is worth the vertical space it costs.
 */
function BlockList({
  field,
  value,
  onChange,
  storeSlug,
  cloudName,
}: {
  field: Extract<Field, { type: 'blocks' }>;
  value: unknown;
  onChange: (next: Block[]) => void;
  storeSlug: string;
  cloudName: string | null;
}) {
  const blocks: Block[] = Array.isArray(value) ? (value as Block[]) : [];
  const atMax = blocks.length >= field.max;
  const atMin = field.min !== undefined && blocks.length <= field.min;

  const replace = (index: number, patch: Block) =>
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));

  const remove = (index: number) => onChange(blocks.filter((_, i) => i !== index));

  const move = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(to, 0, moved);
    onChange(next);
  };

  const add = () => {
    // Seeded from the sub-fields' own defaults, so a new slide arrives with the
    // same shape the validator expects rather than an empty object it rejects.
    const fresh: Block = {};
    for (const sub of field.fields) {
      if ('default' in sub && sub.default !== undefined) fresh[sub.key] = sub.default;
    }
    onChange([...blocks, fresh]);
  };

  return (
    <View style={styles.blocks}>
      <Text style={styles.blocksTitle}>{field.label}</Text>
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}

      {blocks.map((block, index) => (
        <View key={index} style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockLabel}>
              {field.itemLabel} {index + 1}
            </Text>
            <View style={styles.blockTools}>
              <Pressable
                onPress={() => move(index, -1)}
                disabled={index === 0}
                accessibilityRole='button'
                accessibilityLabel={`Move ${field.itemLabel} ${index + 1} up`}
                hitSlop={6}
              >
                <Ionicons
                  name='chevron-up'
                  size={16}
                  color={index === 0 ? color.line : color.body}
                />
              </Pressable>
              <Pressable
                onPress={() => move(index, 1)}
                disabled={index === blocks.length - 1}
                accessibilityRole='button'
                accessibilityLabel={`Move ${field.itemLabel} ${index + 1} down`}
                hitSlop={6}
              >
                <Ionicons
                  name='chevron-down'
                  size={16}
                  color={index === blocks.length - 1 ? color.line : color.body}
                />
              </Pressable>
              <Pressable
                onPress={() => remove(index)}
                disabled={atMin}
                accessibilityRole='button'
                accessibilityLabel={`Remove ${field.itemLabel} ${index + 1}`}
                hitSlop={6}
              >
                <Ionicons
                  name='trash-outline'
                  size={16}
                  color={atMin ? color.line : color.danger}
                />
              </Pressable>
            </View>
          </View>

          {field.fields.map((sub) => (
            <FieldControl
              key={sub.key}
              field={sub}
              value={block[sub.key]}
              onChange={(next) => replace(index, { [sub.key]: next })}
              storeSlug={storeSlug}
              cloudName={cloudName}
            />
          ))}
        </View>
      ))}

      <Pressable
        onPress={add}
        disabled={atMax}
        accessibilityRole='button'
        style={({ pressed }) => [styles.add, pressed && styles.pressed, atMax && styles.addOff]}
      >
        <Ionicons name='add' size={16} color={atMax ? color.muted : color.primary700} />
        <Text style={[styles.addText, atMax && { color: color.muted }]}>
          {atMax ? `${field.max} is the most you can add` : `Add ${field.itemLabel.toLowerCase()}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  fill: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xxl },
  lead: { ...text.small, color: color.muted, marginBottom: space.xl },
  help: { ...text.small, color: color.muted, marginBottom: space.sm },

  blocks: { marginBottom: space.xl },
  blocksTitle: { ...text.label, color: color.ink, marginBottom: space.sm },
  block: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.sm,
  },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  blockLabel: { ...text.small, color: color.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  blockTools: { flexDirection: 'row', gap: space.lg },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingVertical: space.md,
  },
  addOff: { opacity: 0.7 },
  addText: { ...text.small, color: color.primary700 },

  pressed: { opacity: 0.85 },
});
