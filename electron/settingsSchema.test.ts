import { describe, expect, it } from 'vitest';
import { desktopSettingsSchema } from './settingsSchema';

describe('desktopSettingsSchema aiDj settings', () => {
  it('defaults the AI DJ to disabled with a sensible configuration', () => {
    const parsed = desktopSettingsSchema.parse({});
    expect(parsed.aiDj).toEqual({
      enabled: false,
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      baseUrl: 'https://api.groq.com/openai/v1',
      interval: 6,
      voice: 'en_US-ryan-high',
    });
  });

  it('keeps existing desktop settings intact when aiDj is absent', () => {
    const parsed = desktopSettingsSchema.parse({ trayOnClose: false, updateChannel: 'beta' });
    expect(parsed.trayOnClose).toBe(false);
    expect(parsed.updateChannel).toBe('beta');
    expect(parsed.aiDj.enabled).toBe(false);
  });

  it('round-trips an enabled aiDj configuration', () => {
    const parsed = desktopSettingsSchema.parse({
      aiDj: {
        enabled: true,
        provider: 'openai',
        model: 'gpt-5.6-luna',
        baseUrl: 'https://api.openai.com/v1',
        interval: 12,
      },
    });
    expect(parsed.aiDj).toEqual({
      enabled: true,
      provider: 'openai',
      model: 'gpt-5.6-luna',
      baseUrl: 'https://api.openai.com/v1',
      interval: 12,
      voice: 'en_US-ryan-high',
    });
  });

  it('rejects an interval outside the allowed range', () => {
    expect(() => desktopSettingsSchema.parse({ aiDj: { interval: 0 } })).toThrow();
    expect(() => desktopSettingsSchema.parse({ aiDj: { interval: 51 } })).toThrow();
  });

  it('stores a partial or empty base URL as typed', () => {
    // The base URL and model are free-form: validation happens at call time,
    // not in the settings store, so a user can type an incomplete value.
    const partial = desktopSettingsSchema.parse({ aiDj: { baseUrl: 'htt', model: '' } });
    expect(partial.aiDj.baseUrl).toBe('htt');
    expect(partial.aiDj.model).toBe('');
  });
});
