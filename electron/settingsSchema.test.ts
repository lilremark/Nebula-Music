import { describe, expect, it } from 'vitest';
import { DEFAULT_LOCAL_DJ } from '../playback/djTypes';
import { desktopSettingsSchema } from './settingsSchema';

describe('desktopSettingsSchema aiDj settings', () => {
  it('defaults the AI DJ to disabled with a sensible configuration', () => {
    const parsed = desktopSettingsSchema.parse({});
    expect(parsed.aiDj).toEqual({
      local: DEFAULT_LOCAL_DJ,
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
      local: DEFAULT_LOCAL_DJ,
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

it('migrates old local DJ settings to visible transcription and persists opt-out', () => {
  const { showTranscript, ...legacy } = DEFAULT_LOCAL_DJ;
  expect(desktopSettingsSchema.parse({ aiDj: { local: legacy } }).aiDj.local.showTranscript).toBe(true);
  expect(desktopSettingsSchema.parse({ aiDj: { local: { ...legacy, showTranscript: false } } }).aiDj.local.showTranscript).toBe(false);
});

describe('desktopSettingsSchema crash reporting', () => {
  it('defaults to not asked, with no install id, for settings files written before the feature', () => {
    const parsed = desktopSettingsSchema.parse({ schemaVersion: 1, trayOnClose: false, updateChannel: 'beta' });
    expect(parsed.crashReports).toBe('unset');
    expect(parsed.crashReportsInstallId).toBeNull();
    expect(parsed.trayOnClose).toBe(false);
  });

  it('accepts an opt-in with a UUID install id', () => {
    const parsed = desktopSettingsSchema.parse({
      crashReports: 'enabled',
      crashReportsInstallId: '6b0b9a5e-2f2e-4a0c-9c43-0d0f7f1b0a11',
    });
    expect(parsed.crashReports).toBe('enabled');
    expect(parsed.crashReportsInstallId).toBe('6b0b9a5e-2f2e-4a0c-9c43-0d0f7f1b0a11');
  });

  it('rejects unknown consent values and non-UUID install ids', () => {
    expect(desktopSettingsSchema.safeParse({ crashReports: 'yes' }).success).toBe(false);
    expect(desktopSettingsSchema.safeParse({ crashReportsInstallId: 'alex@example.com' }).success).toBe(false);
  });
});
