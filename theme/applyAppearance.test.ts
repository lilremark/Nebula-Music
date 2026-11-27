/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import {
  APPEARANCE_STORAGE_KEY,
  applyAppearance,
  applyStoredAppearance,
  persistAppearance,
  readStoredAppearance,
} from './applyAppearance';

const root = document.documentElement;
const fontLinks = () => Array.from(document.head.querySelectorAll('link[data-nebula-font-link]')).map(link => link.getAttribute('data-nebula-font-link'));

afterEach(() => {
  root.removeAttribute('data-nebula-theme');
  root.removeAttribute('data-nebula-background');
  root.style.removeProperty('--nebula-font');
  document.head.querySelectorAll('link[data-nebula-font-link]').forEach(link => link.remove());
  localStorage.clear();
});

describe('applyAppearance', () => {
  it('leaves <html> untouched for the default appearance', () => {
    applyAppearance({ preset: 'default', font: 'manrope', background: 'none' });
    expect(root.hasAttribute('data-nebula-theme')).toBe(false);
    expect(root.hasAttribute('data-nebula-background')).toBe(false);
    expect(root.style.getPropertyValue('--nebula-font')).toBe('');
    expect(fontLinks()).toEqual([]);
  });

  it('sets preset, background and font, loading the font stylesheet once', () => {
    applyAppearance({ preset: 'nord', font: 'dm-sans', background: 'aurora' });
    applyAppearance({ preset: 'nord', font: 'dm-sans', background: 'aurora' });
    expect(root.getAttribute('data-nebula-theme')).toBe('nord');
    expect(root.getAttribute('data-nebula-background')).toBe('aurora');
    expect(root.style.getPropertyValue('--nebula-font')).toContain("'DM Sans'");
    expect(fontLinks()).toEqual(['dm-sans']);
  });

  it('loads JetBrains Mono for ASCII presets whatever the font setting', () => {
    applyAppearance({ preset: 'terminal', font: 'inter', background: 'none' });
    expect(fontLinks()).toEqual(['jetbrains-mono']);
  });

  it('clears attributes when returning to the default and ignores unknown ids', () => {
    applyAppearance({ preset: 'amber', background: 'grid' });
    applyAppearance({ preset: 'not-a-theme' as never, background: 'nope' as never });
    expect(root.hasAttribute('data-nebula-theme')).toBe(false);
    expect(root.hasAttribute('data-nebula-background')).toBe(false);
  });
});

describe('stored appearance', () => {
  it('round-trips through localStorage and normalises on read', () => {
    persistAppearance({ preset: 'forest', font: 'source-serif', background: 'particles' });
    expect(readStoredAppearance()).toEqual({ preset: 'forest', font: 'source-serif', background: 'particles' });
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '{"preset":"gone","font":"inter"}');
    expect(readStoredAppearance()).toEqual({ preset: 'default', font: 'inter', background: 'none' });
    localStorage.setItem(APPEARANCE_STORAGE_KEY, '{not json');
    expect(readStoredAppearance()).toEqual({ preset: 'default', font: 'manrope', background: 'none' });
  });

  it('applies the stored choice at boot', () => {
    persistAppearance({ preset: 'midnight', font: 'manrope', background: 'none' });
    applyStoredAppearance();
    expect(root.getAttribute('data-nebula-theme')).toBe('midnight');
  });
});
