import {
  getEffectiveFont,
  getFontOption,
  getFontStylesheetUrl,
  normalizeAppearance,
  type AppearanceChoice,
  type FontOption,
} from '../constants/appearance';

/** Mirror of the persisted choice, read synchronously at boot to avoid a flash of the default theme. */
export const APPEARANCE_STORAGE_KEY = 'nebula_appearance';

const FONT_LINK_ATTR = 'data-nebula-font-link';

/**
 * Injects the Google Fonts stylesheet for one font once. Allowed by the CSP
 * (fonts.googleapis.com / fonts.gstatic.com); offline the link simply fails
 * and the stack's system fallback renders.
 */
export const ensureFontStylesheet = (font: FontOption, doc: Document = document): void => {
  const href = getFontStylesheetUrl(font);
  if (!href || doc.head.querySelector(`link[${FONT_LINK_ATTR}="${font.id}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(FONT_LINK_ATTR, font.id);
  doc.head.appendChild(link);
};

/** Adds or removes a stylesheet link by key (used for the font-name previews in Settings). */
export const ensureStylesheet = (key: string, href: string, doc: Document = document): void => {
  if (doc.head.querySelector(`link[${FONT_LINK_ATTR}="${key}"]`)) return;
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute(FONT_LINK_ATTR, key);
  doc.head.appendChild(link);
};

/**
 * Reflects the appearance choice on <html> so every surface (including the
 * setup screen and portalled modals) can follow it from CSS:
 * - `data-nebula-theme` (absent for the default preset, so default computes exactly as before)
 * - `data-nebula-background` (absent for 'none')
 * - `--nebula-font` (absent for the default font)
 */
export const applyAppearance = (value: Partial<AppearanceChoice>, doc: Document = document): void => {
  const choice = normalizeAppearance(value);
  const root = doc.documentElement;

  if (choice.preset === 'default') root.removeAttribute('data-nebula-theme');
  else root.setAttribute('data-nebula-theme', choice.preset);

  if (choice.background === 'none') root.removeAttribute('data-nebula-background');
  else root.setAttribute('data-nebula-background', choice.background);

  const font = getFontOption(choice.font);
  if (font.id === 'manrope') root.style.removeProperty('--nebula-font');
  else root.style.setProperty('--nebula-font', font.stack);

  const effective = getEffectiveFont(choice.preset, choice.font);
  ensureFontStylesheet(effective, doc);
};

export const persistAppearance = (value: Partial<AppearanceChoice>, storage: Storage | undefined = globalThis.localStorage): void => {
  try {
    storage?.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalizeAppearance(value)));
  } catch {
    // Storage full or unavailable: the next launch shows the default theme until settings load.
  }
};

export const readStoredAppearance = (storage: Storage | undefined = globalThis.localStorage): AppearanceChoice => {
  try {
    const raw = storage?.getItem(APPEARANCE_STORAGE_KEY);
    return normalizeAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeAppearance(null);
  }
};

/** Boot-time: apply the last known choice before React renders. */
export const applyStoredAppearance = (doc: Document = document): void => {
  try {
    applyAppearance(readStoredAppearance(), doc);
  } catch {
    // Never block startup on appearance.
  }
};
