import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { themeColors } from './tokens';

// The no-JS / pre-hydration CSS fallback must match the runtime palettes.
// This catches a refinement updating one consumer and leaving the other stale.
describe('theme fallback parity', () => {
  const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
  const [lightCss, darkCss] = css.split('@media (prefers-color-scheme: dark)');

  for (const [mode, source] of [['light', lightCss], ['dark', darkCss]] as const) {
    it(`keeps the ${mode} CSS fallback aligned with the shared palette`, () => {
      for (const [name, value] of Object.entries(themeColors[mode])) {
        const declaration = source.match(new RegExp(`--theme-${name}:\\s*([^;]+);`));
        expect(declaration?.[1].trim(), `${mode}: --theme-${name}`).toBe(value);
      }
    });
  }
});
