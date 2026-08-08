import { describe, expect, it } from 'vitest';
import { sanitizeServerUrlForSettings } from './urlSanitize';

describe('sanitizeServerUrlForSettings', () => {
  it('strips userinfo from https URLs', () => {
    expect(sanitizeServerUrlForSettings('https://user:pass@music.example.com')).toBe('https://music.example.com/');
  });
  it('leaves URLs without userinfo unchanged', () => {
    expect(sanitizeServerUrlForSettings('https://music.example.com/base')).toBe('https://music.example.com/base');
  });
});
