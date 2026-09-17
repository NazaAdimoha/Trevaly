import { describe, expect, it } from 'vitest';

import {
  contrastRatio,
  ensureContrast,
  proposeAccent,
  readableInk,
} from '@core/storefront/color';
import {
  defaultLayout,
  layoutSchema,
  parseLayout,
  sectionId,
} from '@core/storefront/layout';
import {
  availableSections,
  defaultSettings,
  SECTIONS,
  sectionSettingsSchema,
} from '@core/storefront/registry';
import {
  PRESET_KEYS,
  presetForTheme,
  PRESETS,
  resolveTokens,
  tokensToCssVars,
} from '@core/storefront/tokens';

/**
 * The storefront design system's load-bearing promises:
 *
 *  - a merchant's colour is kept but made legible, never silently replaced
 *  - a section's own defaults satisfy its own schema (a drifted default is a
 *    section that cannot be added)
 *  - a bad section loses itself, never the page
 */

describe('colour', () => {
  it('keeps a legible accent untouched', () => {
    expect(ensureContrast('#2F4434', '#FFFFFF')).toBe('#2F4434');
  });

  it('darkens a pale accent until a label on it can be read', () => {
    const pale = '#FAF089';
    expect(contrastRatio(pale, '#FFFFFF')).toBeLessThan(3);

    const fixed = ensureContrast(pale, '#FFFFFF');
    expect(contrastRatio(fixed, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    // Still recognisably the merchant's colour, not a substitute.
    expect(fixed).not.toBe('#111111');
  });

  it('lightens instead when the canvas is dark', () => {
    const fixed = ensureContrast('#1A1A2E', '#0A0A0B');
    expect(contrastRatio(fixed, '#0A0A0B')).toBeGreaterThanOrEqual(3);
  });

  it('picks readable text for a button of any colour', () => {
    expect(readableInk('#C6F24E')).toBe('#111111');
    expect(readableInk('#2F4434')).toBe('#FFFFFF');
  });

  it('proposes the saturated colour from a logo, not its background', () => {
    // A logo that is mostly white with a red mark.
    expect(proposeAccent(['#FFFFFF', '#F2F2F2', '#D32F2F'], '#FFFFFF', '#111111')).toBe(
      '#D32F2F',
    );
  });

  it('falls back when a logo has no usable colour', () => {
    expect(proposeAccent(['#FFFFFF', '#FAFAFA'], '#FFFFFF', '#2F4434')).toBe('#2F4434');
  });
});

describe('presets and tokens', () => {
  it('every preset resolves and every colour is a hex value', () => {
    for (const key of PRESET_KEYS) {
      const tokens = resolveTokens(key);
      for (const [role, value] of Object.entries(tokens.color)) {
        expect(value, `${key}.${role}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });

  it('body text passes AA against its own canvas in every preset', () => {
    for (const key of PRESET_KEYS) {
      const { color } = PRESETS[key].tokens;
      expect(contrastRatio(color.ink, color.bg), key).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(color.inkMuted, color.bg), key).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('applies a merchant override on top of a preset', () => {
    const tokens = resolveTokens('atelier', {
      accent: '#D32F2F',
      density: 'compact',
      mediaRatio: '1:1',
    });
    expect(tokens.color.accent).toBe('#D32F2F');
    expect(tokens.layout.density).toBe('compact');
    expect(tokens.media.ratio).toBe('1:1');
    // Untouched parts still come from the preset.
    expect(tokens.type.display).toBe('serif');
  });

  it('still emits the variables the current components read', () => {
    const vars = tokensToCssVars(resolveTokens('momentum'), '#123456');
    // New names.
    expect(vars['--st-accent']).toBe(PRESETS.momentum.tokens.color.accent);
    expect(vars['--st-ease']).toContain('cubic-bezier');
    // Legacy names still consumed by the grid, cards and shell today.
    expect(vars['--st-product-aspect']).toBe('1 / 1');
    expect(vars['--st-cols-lg']).toBe('4');
    expect(vars['--st-section-pad']).toBeTruthy();
    expect(vars['--brand']).toBe('#123456');
  });

  it('maps the legacy theme enum onto a preset', () => {
    expect(presetForTheme('EDITORIAL')).toBe('atelier');
    expect(presetForTheme(null)).toBe('momentum');
  });
});

describe('section registry', () => {
  it("every section's defaults satisfy its own schema", () => {
    for (const section of SECTIONS) {
      const schema = sectionSettingsSchema(section.type);
      if (!schema) throw new Error(`${section.type} has no schema`);
      const parsed = schema.safeParse(defaultSettings(section.type));
      expect(parsed.success, `${section.type}: ${JSON.stringify(parsed)}`).toBe(true);
    }
  });

  it('every field key is unique within a section', () => {
    for (const section of SECTIONS) {
      const keys = section.fields.map((f) => f.key);
      expect(new Set(keys).size, section.type).toBe(keys.length);
    }
  });

  it('only offers sections that are actually built', () => {
    const offered = availableSections('home');
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((s) => s.status === 'ready')).toBe(true);
  });

  it('rejects a setting outside its declared bounds', () => {
    const schema = sectionSettingsSchema('collection-row');
    if (!schema) throw new Error('collection-row must be in the registry');
    expect(schema.safeParse({ count: 8 }).success).toBe(true);
    expect(schema.safeParse({ count: 400 }).success).toBe(false);
    expect(schema.safeParse({ layout: 'spiral' }).success).toBe(false);
    expect(schema.safeParse({ nonsense: true }).success).toBe(false);
  });

  it('has no schema for an unknown section', () => {
    expect(sectionSettingsSchema('not-a-section')).toBeNull();
  });
});

describe('layout', () => {
  it('a new store starts with a rendered home page, not a blank one', () => {
    const layout = defaultLayout('obsidian');
    expect(layout.preset).toBe('obsidian');
    expect(layout.pages.home.length).toBeGreaterThan(0);
    expect(layout.announcement.enabled).toBe(true);
    // The dark preset gets the floating header the look depends on.
    expect(layout.header.layout).toBe('floating');
  });

  it('drops a broken section and keeps the rest of the page', () => {
    const layout = defaultLayout();
    const seeded = layout.pages.home.length;
    layout.pages.home.push(
      { id: sectionId('collection-row'), type: 'made-up', visible: true, settings: {} },
      {
        id: sectionId('collection-row'),
        type: 'collection-row',
        visible: true,
        settings: { count: 99999 },
      },
    );

    const { layout: parsed, problems } = parseLayout(layout);
    // The two broken ones are gone; everything the store started with survives.
    expect(parsed.pages.home).toHaveLength(seeded);
    expect(problems).toHaveLength(2);
  });

  it('seeds a page that works before a merchant uploads a single photo', () => {
    // A hero cannot be seeded — it needs an image only the merchant has — so
    // the default page must still read as a shop without one.
    const types = defaultLayout().pages.home.map((section) => section.type);
    expect(types).toContain('collection-row');
    expect(types).not.toContain('hero');
  });

  it('never throws on rubbish — a storefront must always render', () => {
    const { layout, problems } = parseLayout({ preset: 'not-a-preset', pages: 12 });
    expect(layout.pages.home).toEqual([]);
    expect(problems.length).toBeGreaterThan(0);
    expect(() => layoutSchema.parse(layout)).not.toThrow();
  });

  it('round-trips a layout unchanged', () => {
    const layout = defaultLayout('playful');
    expect(parseLayout(layout).layout).toEqual(layout);
    expect(parseLayout(layout).problems).toEqual([]);
  });
});
