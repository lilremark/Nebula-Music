export type TitleBarMode = 'light' | 'dark';

export interface TitleBarOverlayColors {
  color: string;
  symbolColor: string;
  height: number;
}

const THEMES: Record<TitleBarMode, TitleBarOverlayColors> = {
  dark: { color: '#0b0b12', symbolColor: '#ffffff', height: 64 },
  light: { color: '#fafafa', symbolColor: '#0a0a0a', height: 64 },
};

export const DEFAULT_TITLE_BAR = THEMES.dark;

export const isTitleBarMode = (value: unknown): value is TitleBarMode =>
  value === 'light' || value === 'dark';

export const titleBarThemeFor = (mode: TitleBarMode): TitleBarOverlayColors =>
  THEMES[mode];
