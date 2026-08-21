import { describe, expect, it } from 'vitest';
import {
  PROVIDER_CATALOG,
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  DEFAULT_AI_BASE_URL,
  getProviderById,
  getModelsForProvider,
  getBaseUrlForProvider,
  isCustomProvider,
} from './providerCatalog';
import { desktopSettingsSchema, AVAILABLE_DJ_VOICES, DEFAULT_DJ_VOICE } from '../settingsSchema';

const EXPECTED_PROVIDER_IDS = [
  'openai',
  'anthropic',
  'google',
  'openrouter',
  'groq',
  'xai',
  'mistral',
  'deepseek',
  'together',
  'cohere',
  'fireworks',
  'cerebras',
  'nvidia',
  'ollama',
  'lmstudio',
  'custom',
];

describe('provider catalog shape', () => {
  it('contains all curated providers plus custom', () => {
    const ids = PROVIDER_CATALOG.map((p) => p.id);
    for (const expected of EXPECTED_PROVIDER_IDS) {
      expect(ids).toContain(expected);
    }
    expect(ids).toHaveLength(EXPECTED_PROVIDER_IDS.length);
  });

  it('gives each non-custom provider 2-3 models and a non-empty base URL', () => {
    for (const entry of PROVIDER_CATALOG) {
      if (entry.id === 'custom') {
        expect(entry.models).toEqual([]);
        expect(entry.baseUrl).toBe('');
        continue;
      }
      expect(entry.baseUrl.length).toBeGreaterThan(0);
      expect(entry.models.length).toBeGreaterThanOrEqual(2);
      expect(entry.models.length).toBeLessThanOrEqual(3);
      for (const m of entry.models) {
        expect(m.id.length).toBeGreaterThan(0);
        expect(m.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('exposes helpers for provider lookup and models', () => {
    const groq = getProviderById('groq');
    expect(groq?.label).toBe('Groq');
    expect(getModelsForProvider('groq').length).toBeGreaterThanOrEqual(2);
    expect(getBaseUrlForProvider('groq')).toBe('https://api.groq.com/openai/v1');
    expect(isCustomProvider('custom')).toBe(true);
    expect(isCustomProvider('groq')).toBe(false);
    expect(getProviderById('does-not-exist')).toBeUndefined();
    expect(getModelsForProvider('does-not-exist')).toEqual([]);
  });

  it('has a cheap aggregator-friendly default (groq gpt-oss-20b) selectable without extra setup', () => {
    expect(DEFAULT_AI_PROVIDER).toBe('groq');
    expect(DEFAULT_AI_MODEL).toBe('openai/gpt-oss-20b');
    expect(DEFAULT_AI_BASE_URL).toBe('https://api.groq.com/openai/v1');
    const def = getProviderById(DEFAULT_AI_PROVIDER);
    expect(def).toBeDefined();
    expect(def?.models.map((m) => m.id)).toContain(DEFAULT_AI_MODEL);
    expect(def?.baseUrl).toBe(DEFAULT_AI_BASE_URL);
  });
});

describe('catalog persistence through settings', () => {
  it('defaults align with desktop settings defaults', () => {
    const parsed = desktopSettingsSchema.parse({});
    expect(parsed.aiDj.provider).toBe(DEFAULT_AI_PROVIDER);
    expect(parsed.aiDj.model).toBe(DEFAULT_AI_MODEL);
    expect(parsed.aiDj.baseUrl).toBe(DEFAULT_AI_BASE_URL);
    expect(parsed.aiDj.voice).toBe(DEFAULT_DJ_VOICE);
  });

  it('round-trips provider/model/baseUrl/voice for every catalog provider plus custom', () => {
    for (const entry of PROVIDER_CATALOG) {
      const model = entry.models[0]?.id ?? 'my-custom-model';
      const baseUrl = entry.baseUrl || 'https://custom.example.com/v1';
      const parsed = desktopSettingsSchema.parse({
        aiDj: { enabled: true, provider: entry.id, model, baseUrl, voice: AVAILABLE_DJ_VOICES[1] },
      });
      expect(parsed.aiDj.provider).toBe(entry.id);
      expect(parsed.aiDj.model).toBe(model);
      expect(parsed.aiDj.baseUrl).toBe(baseUrl);
      expect(parsed.aiDj.voice).toBe(AVAILABLE_DJ_VOICES[1]);
    }
  });

  it('persists a custom provider with free-form base URL and model', () => {
    const parsed = desktopSettingsSchema.parse({
      aiDj: { provider: 'custom', model: 'my-local-llm', baseUrl: 'http://localhost:9999/v1', voice: 'en_GB-alan-medium' },
    });
    expect(parsed.aiDj.provider).toBe('custom');
    expect(parsed.aiDj.model).toBe('my-local-llm');
    expect(parsed.aiDj.baseUrl).toBe('http://localhost:9999/v1');
    expect(parsed.aiDj.voice).toBe('en_GB-alan-medium');
  });

  it('persists DJ voice selection and exposes available voices', () => {
    expect(AVAILABLE_DJ_VOICES.length).toBeGreaterThanOrEqual(4);
    for (const voice of AVAILABLE_DJ_VOICES) {
      const parsed = desktopSettingsSchema.parse({ aiDj: { voice } });
      expect(parsed.aiDj.voice).toBe(voice);
    }
  });
});
