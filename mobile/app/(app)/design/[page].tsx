import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Section } from '@core/storefront/layout';
import {
  availableSections,
  type PageKey,
  PAGE_KEYS,
  sectionDefinition,
} from '@core/storefront/registry';

import { PublishBar } from '@/design/publish-bar';
import {
  addSection,
  moveSection,
  removeSection,
  toggleSection,
  useDesign,
} from '@/store/design';
import { color, radius, space, text } from '@/theme';
import { EmptyStateAction, Loading } from '@/ui';

const PAGE_TITLE: Record<PageKey, string> = {
  home: 'Home page',
  product: 'Product pages',
  collection: 'Collection pages',
};

const isPageKey = (value: unknown): value is PageKey =>
  typeof value === 'string' && (PAGE_KEYS as readonly string[]).includes(value);

/**
 * The sections on one page, in the order a shopper scrolls through them.
 *
 * Reordering is two arrows per row, not drag-and-drop. That is a deliberate
 * choice, not a shortcut: a long-press drag inside a scrolling list is the most
 * failure-prone interaction on a phone — it fights the scroll, needs a gesture
 * handler, and is close to unusable for anyone with a motor impairment. Arrows
 * are unambiguous, reachable one-handed, and work with a screen reader.
 */
export default function PageSectionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ page: string }>();
  const design = useDesign();
  const [adding, setAdding] = useState(false);

  const page = isPageKey(params.page) ? params.page : 'home';

  if (!design.layout) return <Loading />;
  const sections = design.layout.pages[page];

  const confirmRemove = (section: Section) => {
    const definition = sectionDefinition(section.type);
    Alert.alert(
      `Remove ${definition?.label ?? 'this section'}?`,
      'Its settings go with it. You can add it again, but you will have to fill it in.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => removeSection(page, section.id),
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: PAGE_TITLE[page] }} />

      <ScrollView contentContainerStyle={styles.content}>
        {sections.length === 0 ? (
          <EmptyStateAction
            icon='layers-outline'
            title='No sections yet'
            body='Sections are the blocks a shopper scrolls through — a banner, a row of products, your story.'
            actionLabel='Add a section'
            onAction={() => setAdding(true)}
          />
        ) : (
          <>
            <Text style={styles.lead}>
              Shoppers see these top to bottom. Tap one to edit it.
            </Text>

            {sections.map((section, index) => (
              <SectionRow
                key={section.id}
                section={section}
                index={index}
                count={sections.length}
                onOpen={() =>
                  router.push({
                    pathname: '/design/section',
                    params: { page, id: section.id },
                  })
                }
                onMove={(direction) => moveSection(page, section.id, direction)}
                onToggle={() => toggleSection(page, section.id)}
                onRemove={() => confirmRemove(section)}
              />
            ))}

            <Pressable
              onPress={() => setAdding(true)}
              accessibilityRole='button'
              style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            >
              <Ionicons name='add' size={18} color={color.primary700} />
              <Text style={styles.addText}>Add a section</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <AddSheet
        page={page}
        visible={adding}
        onClose={() => setAdding(false)}
        onPick={(type) => {
          const id = addSection(page, type);
          setAdding(false);
          router.push({ pathname: '/design/section', params: { page, id } });
        }}
      />

      <PublishBar />
    </View>
  );
}

function SectionRow({
  section,
  index,
  count,
  onOpen,
  onMove,
  onToggle,
  onRemove,
}: {
  section: Section;
  index: number;
  count: number;
  onOpen: () => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const definition = sectionDefinition(section.type);

  return (
    <View style={[styles.row, !section.visible && styles.rowHidden]}>
      <View style={styles.arrows}>
        <Pressable
          onPress={() => onMove(-1)}
          disabled={index === 0}
          accessibilityRole='button'
          accessibilityLabel={`Move ${definition?.label ?? section.type} up`}
          hitSlop={6}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons
            name='chevron-up'
            size={16}
            color={index === 0 ? color.line : color.body}
          />
        </Pressable>
        <Pressable
          onPress={() => onMove(1)}
          disabled={index === count - 1}
          accessibilityRole='button'
          accessibilityLabel={`Move ${definition?.label ?? section.type} down`}
          hitSlop={6}
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Ionicons
            name='chevron-down'
            size={16}
            color={index === count - 1 ? color.line : color.body}
          />
        </Pressable>
      </View>

      <Pressable onPress={onOpen} accessibilityRole='button' style={styles.rowBody}>
        <Text style={styles.rowLabel}>
          {/* The section's own name if the app knows it; the raw type if this
              build is older than the layout. Never a blank row. */}
          {definition?.label ?? section.type}
        </Text>
        <Text style={styles.rowNote}>
          {section.visible ? definition?.description ?? '' : 'Hidden from shoppers'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onToggle}
        accessibilityRole='button'
        accessibilityLabel={section.visible ? 'Hide section' : 'Show section'}
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons
          name={section.visible ? 'eye-outline' : 'eye-off-outline'}
          size={18}
          color={section.visible ? color.body : color.muted}
        />
      </Pressable>

      <Pressable
        onPress={onRemove}
        accessibilityRole='button'
        accessibilityLabel='Remove section'
        hitSlop={8}
        style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
      >
        <Ionicons name='trash-outline' size={18} color={color.danger} />
      </Pressable>
    </View>
  );
}

/**
 * What can go on this page, grouped.
 *
 * Read from the registry, so a section added to the shared package appears here
 * with no app release. `planned` sections are filtered out by
 * `availableSections` — offering a merchant something that renders as nothing
 * is worse than not offering it.
 */
function AddSheet({
  page,
  visible,
  onClose,
  onPick,
}: {
  page: PageKey;
  visible: boolean;
  onClose: () => void;
  onPick: (type: string) => void;
}) {
  const design = useDesign();
  const existing = design.layout?.pages[page] ?? [];

  const options = availableSections(page).filter(
    (definition) =>
      // A singleton already on the page cannot be added twice.
      !definition.singleton || !existing.some((s) => s.type === definition.type),
  );

  return (
    <Modal visible={visible} animationType='slide' presentationStyle='pageSheet'>
      <View style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Add a section</Text>
          <Pressable onPress={onClose} accessibilityRole='button' hitSlop={8}>
            <Ionicons name='close' size={24} color={color.body} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {options.map((definition) => (
            <Pressable
              key={definition.type}
              onPress={() => onPick(definition.type)}
              accessibilityRole='button'
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <Text style={styles.rowLabel}>{definition.label}</Text>
              <Text style={styles.rowNote}>{definition.description}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.ground },
  content: { padding: space.lg, paddingBottom: space.xxl },
  lead: { ...text.small, color: color.muted, marginBottom: space.md },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingRight: space.sm,
    marginBottom: space.sm,
  },
  rowHidden: { backgroundColor: color.sunk },
  arrows: { paddingLeft: space.sm, paddingVertical: space.sm },
  arrow: { paddingVertical: 2, paddingHorizontal: space.xs },
  rowBody: { flex: 1, paddingVertical: space.lg, paddingHorizontal: space.md },
  rowLabel: { ...text.body, color: color.ink },
  rowNote: { ...text.small, color: color.muted, marginTop: 2 },
  iconButton: { padding: space.sm },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    marginTop: space.sm,
  },
  addText: { ...text.body, color: color.primary700 },

  sheet: { flex: 1, backgroundColor: color.ground },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.line,
  },
  sheetTitle: { ...text.heading, color: color.ink },
  option: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.sm,
  },

  pressed: { opacity: 0.85 },
});
