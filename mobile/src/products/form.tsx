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
 * Options — sizes, colours, weights.
 *
 * Deliberately ONE axis, matching the schema: a dress in S/M/L, a shoe in
 * 39-44, rice in 5kg/10kg. That covers nearly everything a thirty-product shop
 * sells, and a merchant who genuinely needs two lists "Red / Small" as a value.
 *
 * Each option carries its own count, because that is what the storefront
 * actually reads — selling the last size 42 must not mark size 40 sold out. The
 * price is left blank to inherit, so the common case is no typing at all.
 */
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

  const replace = (index: number, patch: Partial<VariantDraft>) =>
    onVariants(variants.map((v, i) => (i === index ? { ...v, ...patch } : v)));

  const add = () =>
    onVariants([...variants, { value: '', price: '', stock: '1', isActive: true }]);

  const remove = (index: number) => {
    const next = variants.filter((_, i) => i !== index);
    onVariants(next);
    // Clearing the last option also clears the name, or the API refuses the
    // save with "add at least one" for a list the merchant just emptied.
    if (next.length === 0) onOptionName('');
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => {
          setOpen(true);
          add();
        }}
        accessibilityRole='button'
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Ionicons name='add' size={16} color={color.primary700} />
        <Text style={styles.addText}>Sell this in sizes or colours</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.options}>
      <Field label='What varies?' hint='Size, Colour, Weight — whatever a shopper picks.'>
        <TextInput
          value={optionName}
          onChangeText={onOptionName}
          placeholder='Size'
          placeholderTextColor={color.muted}
          style={styles.input}
        />
      </Field>

      {variants.map((variant, index) => (
        <View key={variant.id ?? index} style={styles.variant}>
          <View style={styles.variantHead}>
            <TextInput
              value={variant.value}
              onChangeText={(value) => replace(index, { value })}
              placeholder={optionName ? `e.g. ${index === 0 ? 'Small' : 'Large'}` : 'Value'}
              placeholderTextColor={color.muted}
              style={[styles.input, styles.variantValue]}
            />
            <Pressable
              onPress={() => remove(index)}
              accessibilityRole='button'
              accessibilityLabel={`Remove option ${index + 1}`}
              hitSlop={8}
              style={styles.variantRemove}
            >
              <Ionicons name='trash-outline' size={18} color={color.danger} />
            </Pressable>
          </View>

          <View style={styles.variantRow}>
            <View style={styles.variantCell}>
              <Text style={styles.hint}>How many</Text>
              <TextInput
                value={variant.stock}
                onChangeText={(value) => replace(index, { stock: value })}
                keyboardType='number-pad'
                style={styles.input}
              />
            </View>
            <View style={styles.variantCell}>
              <Text style={styles.hint}>Price (optional)</Text>
              <TextInput
                value={variant.price}
                onChangeText={(value) => replace(index, { price: value })}
                keyboardType='numeric'
                placeholder='Same'
                placeholderTextColor={color.muted}
                style={styles.input}
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable
        onPress={add}
        accessibilityRole='button'
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Ionicons name='add' size={16} color={color.primary700} />
        <Text style={styles.addText}>Add another</Text>
      </Pressable>
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
