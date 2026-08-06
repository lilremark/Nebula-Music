import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TITLE_BAR,
  isTitleBarMode,
  titleBarThemeFor,
} from './titleBarTheme';

describe('titleBarTheme', () => {
  it('defaults to the dark overlay', () => {
    expect(DEFAULT_TITLE_BAR).toEqual({
      color: '#0b0b12',
      symbolColor: '#ffffff',
      height: 64,
    });
  });

  it('maps dark mode to the dark colors and the 64px height', () => {
    expect(titleBarThemeFor('dark')).toEqual(DEFAULT_TITLE_BAR);
  });

  it('maps light mode to light colors and the 64px height', () => {
    expect(titleBarThemeFor('light')).toEqual({
      color: '#fafafa',
      symbolColor: '#0a0a0a',
      height: 64,
    });
  });

  it('validates the title bar mode', () => {
    expect(isTitleBarMode('light')).toBe(true);
    expect(isTitleBarMode('dark')).toBe(true);
    expect(isTitleBarMode('system')).toBe(false);
    expect(isTitleBarMode(null)).toBe(false);
    expect(isTitleBarMode(42)).toBe(false);
  });
});
