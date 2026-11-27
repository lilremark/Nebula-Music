import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_IDS,
  BACKGROUND_OPTIONS,
  DEFAULT_APPEARANCE,
  FONT_IDS,
  FONT_OPTIONS,
  THEME_PRESETS,
  THEME_PRESET_IDS,
  getBackgroundOption,
  getEffectiveFont,
  getFontOption,
  getFontPreviewStylesheetUrl,
  getFontStylesheetUrl,
  getThemePreset,
  isAsciiPreset,
  normalizeAppearance,
  normalizeThemeSettings,
} from './appearance';

describe('appearance registry', () => {
  it('has one entry per id, in id order', () => {
    expect(THEME_PRESETS.map(preset => preset.id)).toEqual([...THEME_PRESET_IDS]);
    expect(FONT_OPTIONS.map(font => font.id)).toEqual([...FONT_IDS]);
    expect(BACKGROUND_OPTIONS.map(option => option.id)).toEqual([...BACKGROUND_IDS]);
  });

  it('gives every non-default preset light and dark swatches', () => {
    for (const preset of THEME_PRESETS) {
      expect(preset.swatches.light.length).toBeGreaterThanOrEqual(3);
      expect(preset.swatches.dark.length).toBe(preset.swatches.light.length);
    }
  });

  it('looks up known ids and falls back to defaults for unknown ones', () => {
    expect(getThemePreset('nord').name).toBe('Nord');
    expect(getThemePreset('removed-theme').id).toBe('default');
    expect(getThemePreset(undefined).id).toBe('default');
    expect(getFontOption('dm-sans').name).toBe('DM Sans');
    expect(getFontOption(42).id).toBe('manrope');
    expect(getBackgroundOption('ascii-rain').canvas).toBe(true);
    expect(getBackgroundOption('meteors').id).toBe('none');
  });

  it('marks only the terminal presets as ASCII and forces their monospace font', () => {
    expect(THEME_PRESETS.filter(preset => isAsciiPreset(preset.id)).map(preset => preset.id)).toEqual(['terminal', 'amber', 'ascii-mono']);
    expect(getEffectiveFont('amber', 'source-serif').id).toBe('jetbrains-mono');
    expect(getEffectiveFont('forest', 'source-serif').id).toBe('source-serif');
    expect(getEffectiveFont('bogus', 'bogus').id).toBe('manrope');
  });

  it('ends every font stack with a generic family so offline still renders', () => {
    for (const font of FONT_OPTIONS) expect(font.stack).toMatch(/(sans-serif|serif|monospace)$/);
  });

  it('builds Google Fonts URLs only for fonts index.html does not already load', () => {
    expect(getFontStylesheetUrl(getFontOption('manrope'))).toBeNull();
    expect(getFontStylesheetUrl(getFontOption('space-grotesk'))).toBe('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400..700&display=swap');
    const preview = getFontPreviewStylesheetUrl();
    expect(preview.startsWith('https://fonts.googleapis.com/css2?family=')).toBe(true);
    expect(preview).toContain('family=Source+Serif+4:wght@600');
    expect(preview).toContain('&text=');
    expect(preview).not.toContain('Manrope');
  });
});

describe('appearance settings normalisation', () => {
  it('fills defaults for settings saved before appearance existed', () => {
    const old = { primaryColor: '#123456', secondaryColor: '#abcdef', backgroundColor: '#000000' };
    expect(normalizeThemeSettings(old)).toEqual({ ...old, ...DEFAULT_APPEARANCE });
  });

  it('keeps valid choices and replaces unknown or malformed ids', () => {
    expect(normalizeAppearance({ preset: 'terminal', font: 'inter', background: 'aurora' }))
      .toEqual({ preset: 'terminal', font: 'inter', background: 'aurora' });
    expect(normalizeAppearance({ preset: 'synthwave', font: null, background: ['grid'] })).toEqual(DEFAULT_APPEARANCE);
    expect(normalizeAppearance('garbage')).toEqual(DEFAULT_APPEARANCE);
  });
});
