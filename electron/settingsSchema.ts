import { DEFAULT_LOCAL_DJ } from '../playback/djTypes';
import * as z from '../lib/zod';

export const windowBoundsSchema = z.nullable(
  z.object({
    width: z.int().check(z.minimum(320), z.maximum(16384)),
    height: z.int().check(z.minimum(240), z.maximum(16384)),
    x: z.optional(z.int()),
    y: z.optional(z.int()),
  }),
);

export const DEFAULT_DJ_VOICE = 'en_US-ryan-high';

export const AVAILABLE_DJ_VOICES = [
  'en_US-ryan-high',
  'en_US-amy-medium',
  'en_US-lessac-medium',
  'en_GB-alan-medium',
] as const;

export type DjVoiceId = (typeof AVAILABLE_DJ_VOICES)[number] | (string & {});

/**
 * AI DJ configuration. The provider/baseUrl/model select which OpenAI-compatible
 * endpoint the DJ calls; the API key itself lives in the OS credential vault,
 * never here. `interval` is the number of tracks between DJ interludes.
 * `voice` selects the local Piper/VITS voice used for spoken lines.
 */
export const aiDjSettingsSchema = z.object({
  local: z._default(z.object({
    interval: z._default(z.union([z.literal(4), z.literal(5)]), 5),
    voice: z._default(z.enum(['Michael', 'Heart']), 'Michael'),
    style: z._default(z.enum(['standalone', 'over-music']), 'standalone'),
    discovery: z._default(z.enum(['familiar', 'balanced', 'discover']), 'balanced'),
    voiceLevel: z._default(z.number().check(z.minimum(0), z.maximum(1)), 0.85),
    showTranscript: z._default(z.boolean(), true),
  }), DEFAULT_LOCAL_DJ),
  enabled: z._default(z.boolean(), false),
  provider: z._default(z.string().check(z.minLength(1)), 'groq'),
  model: z._default(z.string(), 'openai/gpt-oss-20b'),
  baseUrl: z._default(z.string(), 'https://api.groq.com/openai/v1'),
  interval: z._default(z.int().check(z.minimum(1), z.maximum(50)), 6),
  voice: z._default(z.string().check(z.minLength(1)), DEFAULT_DJ_VOICE),
});

export const AI_DJ_SETTINGS_DEFAULTS: z.infer<typeof aiDjSettingsSchema> = {
  local: { ...DEFAULT_LOCAL_DJ },
  enabled: false,
  provider: 'groq',
  model: 'openai/gpt-oss-20b',
  baseUrl: 'https://api.groq.com/openai/v1',
  interval: 6,
  voice: DEFAULT_DJ_VOICE,
};

export const desktopSettingsSchema = z.object({
  schemaVersion: z._default(z.int().check(z.minimum(1)), 1),
  trayOnClose: z._default(z.boolean(), true),
  minimizeToTray: z._default(z.boolean(), false),
  mediaKeysEnabled: z._default(z.boolean(), true),
  taskbarProgressEnabled: z._default(z.boolean(), true),
  // Server whose credentials live in the OS vault; used to restore the session
  // on startup. Stored here (not in the vault) so the vault stays keyed by URL.
  lastServerUrl: z._default(z.nullable(z.url().check(z.maxLength(2048))), null),
  // Existing explicit opt-ins are preserved when loading saved settings.
  permitInsecureHttp: z._default(z.boolean(), false),
  windowBounds: z._default(windowBoundsSchema, null),
  updateChannel: z._default(z.enum(['stable', 'beta']), 'stable'),
  aiDj: z._default(aiDjSettingsSchema, AI_DJ_SETTINGS_DEFAULTS),
});

export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;

export const DESKTOP_SETTINGS_DEFAULTS: DesktopSettings = {
  schemaVersion: 1,
  trayOnClose: true,
  minimizeToTray: false,
  mediaKeysEnabled: true,
  taskbarProgressEnabled: true,
  lastServerUrl: null,
  permitInsecureHttp: false,
  windowBounds: null,
  updateChannel: 'stable',
  aiDj: { ...AI_DJ_SETTINGS_DEFAULTS },
};
