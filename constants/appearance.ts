/**
 * Appearance registry: theme presets, UI fonts and animated backgrounds.
 *
 * Pure data + lookups only (no DOM access) so it can be unit-tested and shared
 * by the Store (settings normalisation), Settings UI and the boot-time
 * applier in `theme/applyAppearance.ts`. The visual definitions of each preset
 * live in `themes.css`, keyed by `html[data-nebula-theme="<id>"]`.
 */

export const THEME_PRESET_IDS = [
  'default',
  'midnight',
  'graphite',
  'rose',
  'forest',
  'nord',
  'terminal',
  'amber',
  'ascii-mono',
] as const;
export type ThemePresetId = (typeof THEME_PRESET_IDS)[number];

export const FONT_IDS = [
  'manrope',
  'inter',
  'dm-sans',
  'space-grotesk',
  'plus-jakarta-sans',
  'source-serif',
  'jetbrains-mono',
] as const;
export type FontId = (typeof FONT_IDS)[number];

export const BACKGROUND_IDS = [
  'none',
  'aurora',
  'dot-grid',
  'grid',
  'flickering-grid',
  'particles',
  'ascii-field',
  'ascii-rain',
] as const;
export type BackgroundId = (typeof BACKGROUND_IDS)[number];

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  /** 'ascii' presets also switch to a monospace UI font, square corners and flat borders. */
  kind: 'default' | 'color' | 'ascii';
  /** Chips shown on the picker card: canvas, surface, text, accent. */
  swatches: { light: readonly string[]; dark: readonly string[] };
}

/** Chips for the default theme follow the user's own accent colours (see Settings). */
export const THEME_PRESETS: readonly ThemePreset[] = [
  {
    id: 'default', name: 'Nebula', kind: 'default',
    description: 'The standard look. Uses your accent colours below.',
    swatches: { light: ['#f3f4f8', '#ffffff', '#191b27'], dark: ['#000000', '#101010', '#f5f5f5'] },
  },
  {
    id: 'midnight', name: 'Midnight', kind: 'color',
    description: 'Deep navy with a periwinkle accent.',
    swatches: { light: ['#eef1f8', '#ffffff', '#121a33', '#3451d1'], dark: ['#070b16', '#111a2e', '#e6ebf7', '#7b93ff'] },
  },
  {
    id: 'graphite', name: 'Graphite', kind: 'color',
    description: 'Warm neutral greys with a tan accent.',
    swatches: { light: ['#f1efeb', '#fbfaf8', '#24211d', '#8a5a2b'], dark: ['#161514', '#22211f', '#ece9e4', '#d6a676'] },
  },
  {
    id: 'rose', name: 'Rosé', kind: 'color',
    description: 'Warm blush tones with a coral glow.',
    swatches: { light: ['#fbf1f2', '#ffffff', '#2e1a20', '#b8385f'], dark: ['#140c0f', '#22161b', '#f6e9ec', '#f07a9b'] },
  },
  {
    id: 'forest', name: 'Forest', kind: 'color',
    description: 'Moss and pine with a leaf-green accent.',
    swatches: { light: ['#eef3ee', '#fbfdfb', '#15241b', '#2c7a4c'], dark: ['#0a110d', '#142019', '#e4efe7', '#5cc38a'] },
  },
  {
    id: 'nord', name: 'Nord', kind: 'color',
    description: 'Cool arctic slate with frost blue.',
    swatches: { light: ['#eceff4', '#f8f9fb', '#2e3440', '#4f72a0'], dark: ['#242933', '#2e3440', '#eceff4', '#88c0d0'] },
  },
  {
    id: 'terminal', name: 'Terminal Green', kind: 'ascii',
    description: 'Phosphor green on black. Monospace, square corners.',
    swatches: { light: ['#eef2e6', '#f7f9f1', '#0f3d1a', '#157a32'], dark: ['#040704', '#091009', '#a8f5b8', '#39ff6a'] },
  },
  {
    id: 'amber', name: 'Amber CRT', kind: 'ascii',
    description: 'Amber phosphor on black. Monospace, square corners.',
    swatches: { light: ['#f6efe0', '#fbf6ea', '#4a2c05', '#9a5800'], dark: ['#0a0703', '#120d06', '#ffcf7a', '#ffb000'] },
  },
  {
    id: 'ascii-mono', name: 'ASCII Mono', kind: 'ascii',
    description: 'White on black, nothing else. Monospace, square corners.',
    swatches: { light: ['#ffffff', '#f1f1f1', '#000000', '#555555'], dark: ['#000000', '#0b0b0b', '#e8e8e8', '#9c9c9c'] },
  },
];

export interface FontOption {
  id: FontId;
  name: string;
  /** CSS font-family stack, ending in a system fallback so offline still renders. */
  stack: string;
  /** Google Fonts css2 `family=` value; omitted when index.html already loads the family. */
  googleFamily?: string;
}

const SANS_FALLBACK = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const MONO_STACK = "'JetBrains Mono', ui-monospace, 'Cascadia Mono', 'SFMono-Regular', Menlo, Consolas, monospace";

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'manrope', name: 'Manrope', stack: `'Manrope', 'Inter', ${SANS_FALLBACK}` },
  { id: 'inter', name: 'Inter', stack: `'Inter', ${SANS_FALLBACK}`, googleFamily: 'Inter:wght@400..800' },
  { id: 'dm-sans', name: 'DM Sans', stack: `'DM Sans', ${SANS_FALLBACK}`, googleFamily: 'DM+Sans:wght@400..800' },
  { id: 'space-grotesk', name: 'Space Grotesk', stack: `'Space Grotesk', ${SANS_FALLBACK}`, googleFamily: 'Space+Grotesk:wght@400..700' },
  { id: 'plus-jakarta-sans', name: 'Plus Jakarta Sans', stack: `'Plus Jakarta Sans', ${SANS_FALLBACK}`, googleFamily: 'Plus+Jakarta+Sans:wght@400..800' },
  { id: 'source-serif', name: 'Source Serif 4', stack: "'Source Serif 4', 'Iowan Old Style', Georgia, 'Times New Roman', serif", googleFamily: 'Source+Serif+4:wght@400..800' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono', stack: MONO_STACK, googleFamily: 'JetBrains+Mono:wght@400..800' },
];

export interface BackgroundOption {
  id: BackgroundId;
  name: string;
  description: string;
  /** Canvas-driven (vs. pure CSS); canvas variants are frame-capped and paused when hidden. */
  canvas: boolean;
}

export const BACKGROUND_OPTIONS: readonly BackgroundOption[] = [
  { id: 'none', name: 'None', description: 'Plain canvas', canvas: false },
  { id: 'aurora', name: 'Aurora', description: 'Slow drifting colour glow', canvas: false },
  { id: 'dot-grid', name: 'Dot grid', description: 'Soft dotted pattern', canvas: false },
  { id: 'grid', name: 'Grid', description: 'Faint drifting grid lines', canvas: false },
  { id: 'flickering-grid', name: 'Flickering grid', description: 'Squares that softly flicker', canvas: true },
  { id: 'particles', name: 'Particles', description: 'Sparse floating specks', canvas: true },
  { id: 'ascii-field', name: 'ASCII field', description: 'Shifting glyph noise', canvas: true },
  { id: 'ascii-rain', name: 'ASCII rain', description: 'Slow falling glyph columns', canvas: true },
];

export const DEFAULT_APPEARANCE = {
  preset: 'default' as ThemePresetId,
  font: 'manrope' as FontId,
  background: 'none' as BackgroundId,
};

const includes = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const normalizeThemePresetId = (value: unknown): ThemePresetId =>
  includes(THEME_PRESET_IDS, value) ? value : DEFAULT_APPEARANCE.preset;
export const normalizeFontId = (value: unknown): FontId =>
  includes(FONT_IDS, value) ? value : DEFAULT_APPEARANCE.font;
export const normalizeBackgroundId = (value: unknown): BackgroundId =>
  includes(BACKGROUND_IDS, value) ? value : DEFAULT_APPEARANCE.background;

export const getThemePreset = (id: unknown): ThemePreset =>
  THEME_PRESETS.find(preset => preset.id === normalizeThemePresetId(id))!;
export const getFontOption = (id: unknown): FontOption =>
  FONT_OPTIONS.find(font => font.id === normalizeFontId(id))!;
export const getBackgroundOption = (id: unknown): BackgroundOption =>
  BACKGROUND_OPTIONS.find(background => background.id === normalizeBackgroundId(id))!;

export const isAsciiPreset = (id: unknown): boolean => getThemePreset(id).kind === 'ascii';

/**
 * The font the UI actually renders in: ASCII presets force JetBrains Mono
 * regardless of the font setting.
 */
export const getEffectiveFont = (preset: unknown, font: unknown): FontOption =>
  isAsciiPreset(preset) ? getFontOption('jetbrains-mono') : getFontOption(font);

export interface AppearanceChoice {
  preset: ThemePresetId;
  font: FontId;
  background: BackgroundId;
}

/** Coerces any stored shape (old settings, removed ids, garbage) into a valid choice. */
export const normalizeAppearance = (value: unknown): AppearanceChoice => {
  const source = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    preset: normalizeThemePresetId(source.preset),
    font: normalizeFontId(source.font),
    background: normalizeBackgroundId(source.background),
  };
};

/**
 * Merges a theme settings object (as stored) with defaults and coerces the
 * appearance ids. Colour keys pass through untouched.
 */
export const normalizeThemeSettings = <T extends Record<string, unknown>>(theme: T): T & AppearanceChoice => ({
  ...theme,
  ...normalizeAppearance(theme),
});

const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';

/** Full-weight stylesheet URL for a font, or null when index.html already provides it. */
export const getFontStylesheetUrl = (font: FontOption): string | null =>
  font.googleFamily ? `${GOOGLE_FONTS_CSS}?family=${font.googleFamily}&display=swap` : null;

/**
 * One tiny request that loads just the glyphs needed to preview every
 * font name in its own typeface (Google Fonts' `text=` subsetting).
 */
export const getFontPreviewStylesheetUrl = (fonts: readonly FontOption[] = FONT_OPTIONS): string => {
  const families = fonts
    .filter(font => font.googleFamily)
    .map(font => `family=${font.googleFamily!.split(':')[0]}:wght@600`);
  const glyphs = Array.from(new Set(fonts.map(font => font.name).join(''))).sort().join('');
  return `${GOOGLE_FONTS_CSS}?${families.join('&')}&text=${encodeURIComponent(glyphs)}&display=swap`;
};
