import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Field } from '@core/storefront/registry';

import { uploadProductImage } from '@/api/upload';
import { color, font, radius, space, text } from '@/theme';

/**
 * One control per field type in the section registry.
 *
 * This file is the whole point of the registry's shape. A theme store's worth
 * of sections is twenty-odd editing screens if each is hand-written, and they
 * drift the moment a setting is added. Because a section describes its settings
 * as DATA, adding "Countdown bar" ships one web component and one registry
 * entry — and the phone gets a working editor for it with no app release at all.
 *
 * Every control is uncontrolled-on-blur where typing is involved: a merchant on
 * a 5" screen types with the keyboard covering half the form, and re-rendering
 * the whole section on each keystroke is what makes that feel broken.
 */

export function FieldControl({
  field,
  value,
  onChange,
  storeSlug,
  cloudName,
}: {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
  storeSlug: string;
  /** For previewing an uploaded image by its Cloudinary public id. */
  cloudName: string | null;
}) {
  const control = () => {
    switch (field.type) {
      case 'text':
      case 'link':
        return (
          <Line
            value={asString(value)}
            onChange={onChange}
            placeholder={'placeholder' in field ? field.placeholder : undefined}
            max={'max' in field ? field.max : undefined}
            keyboard={field.type === 'link' ? 'url' : 'default'}
          />
        );

      case 'textarea':
      case 'richtext':
        return <Line value={asString(value)} onChange={onChange} max={field.max} multiline />;

      case 'toggle':
        return null; // Rendered inline with the label — see below.

      case 'number':
      case 'range':
        return (
          <Stepper
            value={typeof value === 'number' ? value : field.default}
            min={'min' in field ? field.min : undefined}
            max={'max' in field ? field.max : undefined}
            step={field.step ?? 1}
            onChange={onChange}
          />
        );

      case 'select':
        return <Choices options={field.options} value={asString(value)} onChange={onChange} />;

      case 'color':
        return <ColorField value={asString(value)} onChange={onChange} />;

      case 'image':
      case 'video':
        return (
          <MediaField
            value={value === null || value === undefined ? null : asString(value)}
            onChange={onChange}
            storeSlug={storeSlug}
            cloudName={cloudName}
          />
        );

      case 'datetime':
        return <WhenField value={asString(value)} onChange={onChange} />;

      case 'product':
      case 'collection':
        // Chosen by slug. A picker over the store's catalogue is a screen of
        // its own; until it exists the merchant types the handle they can read
        // off the product page, which is better than a control that lies about
        // being ready.
        return (
          <Line
            value={asString(value)}
            onChange={onChange}
            placeholder={field.type === 'product' ? 'product-slug' : 'collection-slug'}
          />
        );

      default:
        return null;
    }
  };

  if (field.type === 'toggle') {
    return (
      <View style={styles.toggleRow}>
        <View style={styles.toggleText}>
          <Text style={styles.label}>{field.label}</Text>
          {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
        </View>
        <Switch
          value={value === undefined ? field.default : Boolean(value)}
          onValueChange={onChange}
          trackColor={{ false: color.line, true: color.primary200 }}
          thumbColor={value ? color.primary700 : color.surface}
        />
      </View>
    );
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{field.label}</Text>
      {control()}
      {field.help ? <Text style={styles.help}>{field.help}</Text> : null}
    </View>
  );
}

const asString = (value: unknown) => (typeof value === 'string' ? value : '');

/**
 * Text, committed on blur.
 *
 * The draft lives in a module-level store that every Design screen subscribes
 * to, so writing on each keystroke re-renders the section list and the publish
 * bar too. Local state while typing, one commit when the field is left.
 */
function Line({
  value,
  onChange,
  placeholder,
  max,
  multiline,
  keyboard = 'default',
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  max?: number;
  multiline?: boolean;
  keyboard?: 'default' | 'url';
}) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  // Re-seed when the value changes underneath us (a discard, a reload) but
  // never while the merchant is mid-word.
  if (!focused && draft !== value) setDraft(value);

  return (
    <View>
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
        maxLength={max}
        multiline={multiline}
        autoCapitalize={keyboard === 'url' ? 'none' : 'sentences'}
        autoCorrect={keyboard !== 'url'}
        keyboardType={keyboard === 'url' ? 'url' : 'default'}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
      {max && multiline ? (
        <Text style={styles.counter}>
          {draft.length}/{max}
        </Text>
      ) : null}
    </View>
  );
}

/** Plus and minus, not a slider: a slider cannot be hit accurately with a thumb. */
function Stepper({
  value,
  min,
  max,
  step,
  onChange,
}: {
  value: number;
  min?: number;
  max?: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const bump = (direction: -1 | 1) => {
    const next = value + direction * step;
    if (min !== undefined && next < min) return;
    if (max !== undefined && next > max) return;
    onChange(Number(next.toFixed(4)));
  };

  return (
    <View style={styles.stepper}>
      <Pressable
        onPress={() => bump(-1)}
        accessibilityRole='button'
        accessibilityLabel='Decrease'
        disabled={min !== undefined && value <= min}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <Ionicons name='remove' size={18} color={color.ink} />
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable
        onPress={() => bump(1)}
        accessibilityRole='button'
        accessibilityLabel='Increase'
        disabled={max !== undefined && value >= max}
        style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}
      >
        <Ionicons name='add' size={18} color={color.ink} />
      </Pressable>
    </View>
  );
}

/** Every option visible at once. A phone `<Picker>` hides the choices. */
function Choices({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choices}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole='radio'
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.chip,
              active && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A handful of swatches plus the hex, because merchants arrive with a brand. */
const SWATCHES = ['#12130F', '#C6F24E', '#E4572E', '#1F8A4C', '#2F6FED', '#D9A441', '#8C3FBF'];

export function ColorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.choices}>
        {SWATCHES.map((swatch) => (
          <Pressable
            key={swatch}
            onPress={() => onChange(swatch)}
            accessibilityRole='button'
            accessibilityLabel={`Use ${swatch}`}
            style={[
              styles.swatch,
              { backgroundColor: swatch },
              value.toUpperCase() === swatch && styles.swatchActive,
            ]}
          />
        ))}
      </ScrollView>
      <Line value={value} onChange={onChange} placeholder='#000000' keyboard='url' />
    </View>
  );
}

/**
 * An image, uploaded straight to Cloudinary from the phone.
 *
 * Only the PUBLIC ID is stored — bytes never pass through our API, and an id
 * lets the storefront, the app and the OG card each derive their own size
 * rather than sharing one frozen transformation.
 */
function MediaField({
  value,
  onChange,
  storeSlug,
  cloudName,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
  storeSlug: string;
  cloudName: string | null;
}) {
  const [busy, setBusy] = useState(false);

  const preview =
    value && cloudName
      ? `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto,w_600,c_fill/${value}`
      : null;

  const pick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Allow photo access to choose an image.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    const asset = picked.assets?.[0];
    if (picked.canceled || !asset) return;

    setBusy(true);
    try {
      onChange(await uploadProductImage(storeSlug, asset, 'branding'));
    } catch (err) {
      Alert.alert('Upload failed', err instanceof Error ? err.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Pressable
        onPress={pick}
        disabled={busy}
        accessibilityRole='button'
        accessibilityLabel={value ? 'Replace image' : 'Choose image'}
        style={({ pressed }) => [styles.media, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={color.primary700} />
        ) : preview ? (
          <Image source={{ uri: preview }} style={styles.mediaImage} resizeMode='cover' />
        ) : (
          <View style={styles.mediaEmpty}>
            <Ionicons name='image-outline' size={26} color={color.muted} />
            <Text style={styles.help}>Choose a photo</Text>
          </View>
        )}
      </Pressable>
      {value && !busy ? (
        <Pressable onPress={() => onChange(null)} accessibilityRole='button'>
          <Text style={styles.remove}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A date and time, stored as ISO. Used by the countdown section. */
function WhenField({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const parsed = value ? new Date(value) : null;
  const valid = parsed && !Number.isNaN(parsed.getTime());

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole='button'
        style={({ pressed }) => [styles.input, styles.when, pressed && styles.pressed]}
      >
        <Text style={valid ? styles.whenText : styles.whenPlaceholder}>
          {valid ? parsed.toLocaleString() : 'Choose a date and time'}
        </Text>
        <Ionicons name='calendar-outline' size={18} color={color.muted} />
      </Pressable>

      {open ? (
        <DateTimePicker
          value={valid ? parsed : new Date()}
          mode='datetime'
          onChange={(_event, picked) => {
            setOpen(false);
            if (picked) onChange(picked.toISOString());
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.xl },
  label: { ...text.label, color: color.ink, marginBottom: space.sm },
  help: { ...text.small, color: color.muted, marginTop: space.xs },

  input: {
    ...text.body,
    color: color.ink,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  counter: { ...text.small, color: color.muted, textAlign: 'right', marginTop: space.xs },

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  toggleText: { flex: 1 },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: color.line,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  stepperButton: { paddingHorizontal: space.lg, paddingVertical: space.md },
  stepperValue: {
    ...text.body,
    color: color.ink,
    minWidth: 56,
    textAlign: 'center',
    fontFamily: font.medium,
  },

  choices: { marginBottom: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.surface,
    marginRight: space.sm,
  },
  chipActive: { backgroundColor: color.forest900, borderColor: color.forest900 },
  chipText: { ...text.small, color: color.body },
  chipTextActive: { color: '#FFFFFF' },

  swatch: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    marginRight: space.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: color.ink },

  media: {
    height: 150,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.line,
    backgroundColor: color.sunk,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaImage: { width: '100%', height: '100%' },
  mediaEmpty: { alignItems: 'center', gap: space.xs },
  remove: { ...text.small, color: color.danger, marginTop: space.sm },

  when: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  whenText: { ...text.body, color: color.ink },
  whenPlaceholder: { ...text.body, color: color.muted },

  pressed: { opacity: 0.8 },
});
