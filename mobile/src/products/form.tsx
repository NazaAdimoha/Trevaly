import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { toMajor, toMinor } from '@core/money';
import {
  COLOUR_CHOICES,
  colourOf,
  isColourAxis,
  numericRange,
  SIZE_SCALES,
} from '@core/option-values';
import { variantRejectionReason } from '@core/validation/product';

import { color, font, radius, space, text } from '@/theme';
import { formatNaira } from '@/ui';

/**
 * Everything a merchant can set about a product, shared by add and edit.
 *
 * One component on purpose. These two screens diverging is how "you can set a
 * category when you create it but not afterwards" happens, and that is exactly
 * the gap this closes: the app used to collect a name, a price and a count, and
 * send the merchant to a laptop for the rest. Most of them do not have one.
 */
export type Category = { id: string; name: string };

export type ProductDraft = {
  name: string;
  description: string;
  price: string;
  stock: string;
  sku: string;
  categoryId: string | null;
  isActive: boolean;
  optionName: string;
  variants: VariantDraft[];
};

export type VariantDraft = {
  /** Present when editing an option that already exists on the server. */
  id?: string;
  value: string;
  price: string;
  stock: string;
  isActive: boolean;
};

export const emptyDraft = (): ProductDraft => ({
  name: '',
  description: '',
  price: '',
  stock: '1',
  sku: '',
  categoryId: null,
  isActive: true,
  optionName: '',
  variants: [],
});

const digits = (value: string) => value.replace(/[^\d.]/g, '');

/** Mirrors the web form's slug derivation so both produce the same URL. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Turn the form into the API's write payload, or explain what is wrong.
 *
 * Validation runs against the SHARED `variantRejectionReason`, the same
 * function the API and the web form use. A product either sells as one thing or
 * by option, never half of each — and a phone discovering that rule only from a
 * 400 would show a message written for a different form.
 */
export function toPayload(
  draft: ProductDraft,
  imageUrls: string[],
): { payload: Record<string, unknown> } | { error: string } {
  const name = draft.name.trim();
  if (name.length < 2) return { error: 'Give the product a name.' };

  const priceKobo = toMinor(Number(digits(draft.price)));
  if (!Number.isFinite(priceKobo) || priceKobo < 1) {
    return { error: 'Enter a price greater than zero.' };
  }

  const variants = draft.variants.map((variant) => ({
    ...(variant.id ? { id: variant.id } : {}),
    value: variant.value.trim(),
    // Blank inherits the product price. Zero is never a valid override, so an
    // unreadable number is treated as "inherit" rather than as free.
    priceKobo: digits(variant.price)
      ? Math.max(1, toMinor(Number(digits(variant.price))))
      : null,
    stock: Number(variant.stock.replace(/[^\d]/g, '') || '0'),
    isActive: variant.isActive,
  }));

  if (variants.some((variant) => !variant.value)) {
    return { error: 'Give every option a name, or remove the blank one.' };
  }

  const optionName = draft.optionName.trim();
  const rejection = variantRejectionReason({ optionName, variants });
  if (rejection) return { error: rejection };

  return {
    payload: {
      name,
      slug: slugify(name),
      description: draft.description.trim(),
      sku: draft.sku.trim(),
      priceKobo,
      // With options, the parent count is ignored — the truth is per option,
      // and sending a stale number would be a second figure to keep in step.
      stock: variants.length > 0 ? 0 : Number(draft.stock.replace(/[^\d]/g, '') || '0'),
      imageUrls,
      categoryId: draft.categoryId ?? '',
      isActive: draft.isActive,
      optionName,
      variants,
    },
  };
}

/** Seed the form from what the server holds. */
export function draftFrom(product: {
  name: string;
  description: string | null;
  sku: string | null;
  priceKobo: number;
  stock: number;
  isActive: boolean;
  optionName: string | null;
  categoryId: string | null;
  variants: { id: string; value: string; priceKobo: number | null; stock: number; isActive: boolean }[];
}): ProductDraft {
  return {
    name: product.name,
    description: product.description ?? '',
    price: String(toMajor(product.priceKobo)),
    stock: String(product.stock),
    sku: product.sku ?? '',
    categoryId: product.categoryId,
    isActive: product.isActive,
    optionName: product.optionName ?? '',
    variants: product.variants.map((variant) => ({
      id: variant.id,
      value: variant.value,
      price: variant.priceKobo === null ? '' : String(toMajor(variant.priceKobo)),
      stock: String(variant.stock),
      isActive: variant.isActive,
    })),
  };
}

export function ProductFields({
  draft,
  onChange,
  categories,
}: {
  draft: ProductDraft;
  onChange: (next: ProductDraft) => void;
  categories: Category[];
}) {
  const set = <K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) =>
    onChange({ ...draft, [key]: value });

  const sellsByOption = draft.variants.length > 0;

  const nairaPreview = (() => {
    const value = Number(digits(draft.price));
    return Number.isFinite(value) && value > 0 ? formatNaira(toMinor(value)) : null;
  })();

  return (
    <>
      <Field label='Name'>
        <TextInput
          value={draft.name}
          onChangeText={(value) => set('name', value)}
          placeholder='Ankara midi dress'
          placeholderTextColor={color.muted}
          style={styles.input}
        />
      </Field>

      <Field
        label='Description'
        hint='What it is made of, how it fits, how to care for it. Shoppers read this before they ask.'
      >
        <TextInput
          value={draft.description}
          onChangeText={(value) => set('description', value)}
          placeholder='Hand-cut Ankara, fully lined, cold wash only.'
          placeholderTextColor={color.muted}
          multiline
          style={[styles.input, styles.multiline]}
        />
      </Field>

      <Field label='Price' hint={nairaPreview ? `Customers will see ${nairaPreview}` : undefined}>
        <TextInput
          value={draft.price}
          onChangeText={(value) => set('price', value)}
          keyboardType='numeric'
          placeholder='25000'
          placeholderTextColor={color.muted}
          style={styles.input}
        />
      </Field>

      {/* Hidden once options exist: the parent count is ignored then, and
          leaving it on screen invites a merchant to keep two numbers in step
          that the shop does not read. */}
      {sellsByOption ? null : (
        <Field label='How many do you have?'>
          <TextInput
            value={draft.stock}
            onChangeText={(value) => set('stock', value)}
            keyboardType='number-pad'
            style={styles.input}
          />
        </Field>
      )}

      <CategoryPicker
        categories={categories}
        value={draft.categoryId}
        onChange={(value) => set('categoryId', value)}
      />

      <Options
        optionName={draft.optionName}
        variants={draft.variants}
        onOptionName={(value) => set('optionName', value)}
        onVariants={(value) => set('variants', value)}
      />

      <Field label='Item code' hint='Yours to recognise it by. Optional.'>
        <TextInput
          value={draft.sku}
          onChangeText={(value) => set('sku', value)}
          autoCapitalize='characters'
          placeholder='ADW-001'
          placeholderTextColor={color.muted}
          style={styles.input}
        />
      </Field>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.label}>Show on my storefront</Text>
          <Text style={styles.hint}>Turn off to save it without publishing.</Text>
        </View>
        <Switch
          value={draft.isActive}
          onValueChange={(value) => set('isActive', value)}
          trackColor={{ true: color.primary, false: color.line }}
        />
      </View>
    </>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

/**
 * Category as chips, including "None".
 *
 * Every choice visible at once rather than behind a picker: a store has a
 * handful of categories, and the one tap saved is worth more than the row of
 * vertical space it costs. Creating a category is still a web task — this
 * assigns from what exists.
 */
function CategoryPicker({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  if (categories.length === 0) {
    return (
      <Field label='Category' hint='Create categories on the web dashboard to group products.'>
        <Text style={styles.empty}>No categories yet</Text>
      </Field>
    );
  }

  return (
    <Field label='Category'>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Chip label='None' active={value === null} onPress={() => onChange(null)} />
        {categories.map((category) => (
          <Chip
            key={category.id}
            label={category.name}
            active={value === category.id}
            onPress={() => onChange(category.id)}
          />
        ))}
      </ScrollView>
    </Field>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole='radio'
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Options — sizes, colours, weights, or anything else.
 *
 * Still ONE axis, which is the schema's deliberate choice: a dress in S/M/L, a
 * shoe in 39-44, rice in 5kg/10kg. What changed is that the axis stopped
 * *looking* like sizes. It was always free text — "Colour" has been as possible
 * as "Size" since the first migration — but the form hardcoded a "Size"
 * placeholder and an empty row, so a merchant selling in colours had no reason
 * to think they could, and one selling shoes in 38-45 typed eight rows by hand.
 *
 * Now the axis is picked first, and each kind brings the way you would actually
 * enter it: swatches for colour, a letter scale or a number range for size, a
 * range with a unit for weight.
 */
type Axis = 'Size' | 'Colour' | 'Weight' | 'Other';

const AXES: { key: Axis; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'Size', label: 'Size', icon: 'resize-outline' },
  { key: 'Colour', label: 'Colour', icon: 'color-palette-outline' },
  { key: 'Weight', label: 'Weight', icon: 'scale-outline' },
  { key: 'Other', label: 'Something else', icon: 'options-outline' },
];

/** Which kind of axis an option name reads as, for reopening an edit. */
function axisOf(optionName: string): Axis {
  if (isColourAxis(optionName)) return 'Colour';
  if (/size|fit/i.test(optionName)) return 'Size';
  if (/weight|kg|gram|litre|liter|volume/i.test(optionName)) return 'Weight';
  return optionName ? 'Other' : 'Size';
}

function Options({
  optionName,
  variants,
  onOptionName,
  onVariants,
}: {
  optionName: string;
  variants: VariantDraft[];
  onOptionName: (next: string) => void;
  onVariants: (next: VariantDraft[]) => void;
}) {
  const [open, setOpen] = useState(variants.length > 0);
  const [axis, setAxis] = useState<Axis>(() => axisOf(optionName));

  const replace = (index: number, patch: Partial<VariantDraft>) =>
    onVariants(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const blank = (value = ''): VariantDraft => ({
    value,
    price: '',
    stock: '1',
    isActive: true,
  });

  /**
   * Add values, skipping any the product already has.
   *
   * Silent rather than an error: tapping "S · M · L" twice, or adding XS→XXL on
   * top of S/M/L, should top up the list rather than refuse it or create a
   * duplicate the API would reject with a message about a value the merchant
   * cannot see.
   */
  const addValues = (values: string[]) => {
    const seen = new Set(variants.map((v) => v.value.trim().toLowerCase()));
    const fresh = values
      .filter((value) => !seen.has(value.trim().toLowerCase()))
      .map((value) => blank(value));
    if (fresh.length > 0) onVariants([...variants, ...fresh]);
  };

  const remove = (index: number) => {
    const next = variants.filter((_, i) => i !== index);
    onVariants(next);
    // Clearing the last option also clears the name, or the API refuses the
    // save with "add at least one" for a list the merchant just emptied.
    if (next.length === 0) onOptionName('');
  };

  const start = (chosen: Axis) => {
    setAxis(chosen);
    setOpen(true);
    onOptionName(chosen === 'Other' ? '' : chosen);
  };

  if (!open) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>Does this come in different versions?</Text>
        <Text style={styles.hint}>
          Sizes, colours, weights — each one keeps its own stock count.
        </Text>
        <View style={styles.axisRow}>
          {AXES.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => start(option.key)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.axis, pressed && styles.pressed]}
            >
              <Ionicons name={option.icon} size={18} color={color.primary700} />
              <Text style={styles.axisText}>{option.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.options}>
      <Field label="What varies?" hint="This is the word a shopper sees above the choices.">
        <TextInput
          value={optionName}
          onChangeText={(value) => {
            onOptionName(value);
            setAxis(axisOf(value));
          }}
          placeholder="Size"
          placeholderTextColor={color.muted}
          style={styles.input}
        />
      </Field>

      {axis === 'Colour' ? (
        <ColourAdder
          chosen={variants.map((v) => v.value)}
          onAdd={(value) => addValues([value])}
        />
      ) : (
        <ValueAdder axis={axis} onAdd={addValues} />
      )}

      {variants.map((variant, index) => {
        const swatch = colourOf(variant.value);
        return (
          <View key={variant.id ?? index} style={styles.variant}>
            <View style={styles.variantHead}>
              {swatch ? (
                <View style={[styles.swatchDot, { backgroundColor: swatch }]} />
              ) : null}
              <TextInput
                value={variant.value}
                onChangeText={(value) => replace(index, { value })}
                placeholder="Value"
                placeholderTextColor={color.muted}
                style={[styles.input, styles.variantValue]}
              />
              <Pressable
                onPress={() => remove(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${variant.value || `option ${index + 1}`}`}
                hitSlop={8}
                style={styles.variantRemove}
              >
                <Ionicons name="trash-outline" size={18} color={color.danger} />
              </Pressable>
            </View>

            <View style={styles.variantRow}>
              <View style={styles.variantCell}>
                <Text style={styles.hint}>How many</Text>
                <TextInput
                  value={variant.stock}
                  onChangeText={(value) => replace(index, { stock: value })}
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </View>
              <View style={styles.variantCell}>
                <Text style={styles.hint}>Price (optional)</Text>
                <TextInput
                  value={variant.price}
                  onChangeText={(value) => replace(index, { price: value })}
                  keyboardType="numeric"
                  placeholder="Same"
                  placeholderTextColor={color.muted}
                  style={styles.input}
                />
              </View>
            </View>
          </View>
        );
      })}

      <Pressable
        onPress={() => addValues([''])}
        accessibilityRole="button"
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={16} color={color.primary700} />
        <Text style={styles.addText}>Add one by hand</Text>
      </Pressable>
    </View>
  );
}

/**
 * The colour picker: tap a swatch, get the colour.
 *
 * The variant stores the NAME, not the hex — that is what an order email, a
 * receipt and a WhatsApp message have to say, and what the storefront already
 * renders. The swatch is drawn from the shared palette at display time, so no
 * column had to be added to show a circle.
 */
function ColourAdder({
  chosen,
  onAdd,
}: {
  chosen: string[];
  onAdd: (value: string) => void;
}) {
  const taken = new Set(chosen.map((value) => value.trim().toLowerCase()));

  return (
    <View style={styles.field}>
      <Text style={styles.hint}>Tap a colour to add it</Text>
      <View style={styles.palette}>
        {COLOUR_CHOICES.map(([label, css]) => {
          const already = taken.has(label.toLowerCase());
          return (
            <Pressable
              key={label}
              onPress={() => onAdd(label)}
              disabled={already}
              accessibilityRole="button"
              accessibilityLabel={already ? `${label}, already added` : `Add ${label}`}
              style={({ pressed }) => [
                styles.swatch,
                { backgroundColor: css },
                already && styles.swatchTaken,
                pressed && styles.pressed,
              ]}
            >
              {already ? (
                // Ticked rather than hidden: a merchant scanning for "did I add
                // navy" should see it in place, not wonder where it went.
                <Ionicons
                  name="checkmark"
                  size={16}
                  color={css === '#FFFFFF' || css === '#FFFFF0' ? color.ink : '#FFFFFF'}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Letter scales and number ranges — whatever the axis calls for. */
function ValueAdder({ axis, onAdd }: { axis: Axis; onAdd: (values: string[]) => void }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [unit, setUnit] = useState(axis === 'Weight' ? 'kg' : '');

  const range = numericRange(Number(from), Number(to), 1, unit.trim());
  const canAdd = from.trim() !== '' && to.trim() !== '' && range.length > 0;

  return (
    <View style={styles.field}>
      {axis === 'Size' ? (
        <>
          <Text style={styles.hint}>Add a whole scale at once</Text>
          <View style={styles.axisRow}>
            {SIZE_SCALES.map((scale) => (
              <Pressable
                key={scale.label}
                onPress={() => onAdd(scale.values)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.scale, pressed && styles.pressed]}
              >
                <Text style={styles.scaleText}>{scale.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <Text style={[styles.hint, styles.rangeLabel]}>
        {axis === 'Weight' ? 'Or a range of weights' : 'Or a range of numbers'}
      </Text>
      <View style={styles.rangeRow}>
        <TextInput
          value={from}
          onChangeText={setFrom}
          keyboardType="numeric"
          placeholder={axis === 'Weight' ? '1' : '38'}
          placeholderTextColor={color.muted}
          style={[styles.input, styles.rangeInput]}
        />
        <Text style={styles.rangeTo}>to</Text>
        <TextInput
          value={to}
          onChangeText={setTo}
          keyboardType="numeric"
          placeholder={axis === 'Weight' ? '10' : '45'}
          placeholderTextColor={color.muted}
          style={[styles.input, styles.rangeInput]}
        />
        {axis === 'Weight' ? (
          <TextInput
            value={unit}
            onChangeText={setUnit}
            placeholder="kg"
            placeholderTextColor={color.muted}
            style={[styles.input, styles.unitInput]}
          />
        ) : null}
        <Pressable
          onPress={() => {
            onAdd(range);
            setFrom('');
            setTo('');
          }}
          disabled={!canAdd}
          accessibilityRole="button"
          accessibilityLabel="Add this range"
          style={({ pressed }) => [
            styles.rangeAdd,
            !canAdd && styles.rangeAddOff,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="add" size={18} color={canAdd ? '#FFFFFF' : color.muted} />
        </Pressable>
      </View>
      {/* Shown before the tap, because a merchant typing 38 to 45 should see
          eight values coming rather than find out afterwards. */}
      {canAdd ? (
        <Text style={styles.hint}>
          Adds {range.length}: {range.slice(0, 6).join(', ')}
          {range.length > 6 ? '…' : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  label: { ...text.small, color: color.ink, fontFamily: font.medium },
  hint: { ...text.small, color: color.muted },
  empty: { ...text.small, color: color.muted, paddingVertical: space.sm },

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
  multiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },

  chip: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    marginRight: space.sm,
  },
  chipActive: { backgroundColor: color.forest900, borderColor: color.forest900 },
  chipText: { ...text.small, color: color.body },
  chipTextActive: { color: '#FFFFFF' },

  axisRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  axis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  axisText: { ...text.small, color: color.ink, fontFamily: font.medium },

  scale: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
  },
  scaleText: { ...text.small, color: color.ink },

  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  swatch: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchTaken: { opacity: 0.55 },
  swatchDot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
  },

  rangeLabel: { marginTop: space.md },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  rangeInput: { flex: 1, minWidth: 0 },
  unitInput: { width: 64 },
  rangeTo: { ...text.small, color: color.muted },
  rangeAdd: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.primary,
  },
  rangeAddOff: { backgroundColor: color.sunk },

  options: { gap: space.md },
  variant: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.sunk,
  },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  variantValue: { flex: 1, backgroundColor: color.surface },
  variantRemove: { padding: space.sm },
  variantRow: { flexDirection: 'row', gap: space.sm },
  variantCell: { flex: 1, gap: space.xs },

  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 48,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.line,
    borderRadius: radius.md,
  },
  addText: { ...text.small, color: color.primary700, fontFamily: font.medium },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  switchText: { flex: 1, gap: 2 },

  pressed: { opacity: 0.85 },
});
