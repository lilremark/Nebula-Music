import { DEFAULT_LOCAL_DJ } from '../playback/djTypes';
import { z } from 'zod';

export const windowBoundsSchema = z
  .object({
    width: z.number().int().min(320).max(16384),
    height: z.number().int().min(240).max(16384),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
  })
  .nullable();

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
  local: z.object({ interval: z.union([z.literal(4), z.literal(5)]).default(5), voice: z.enum(['Michael', 'Heart']).default('Michael'), style: z.enum(['standalone', 'over-music']).default('standalone'), discovery: z.enum(['familiar', 'balanced', 'discover']).default('balanced'), voiceLevel: z.number().min(0).max(1).default(0.85), showTranscript: z.boolean().default(true) }).default(DEFAULT_LOCAL_DJ),
  enabled: z.boolean().default(false),
  provider: z.string().min(1).default('groq'),
  model: z.string().default('openai/gpt-oss-20b'),
  baseUrl: z.string().default('https://api.groq.com/openai/v1'),
  interval: z.number().int().min(1).max(50).default(6),
  voice: z.string().min(1).default(DEFAULT_DJ_VOICE),
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
  schemaVersion: z.number().int().min(1).default(1),
  trayOnClose: z.boolean().default(true),
  minimizeToTray: z.boolean().default(false),
  mediaKeysEnabled: z.boolean().default(true),
  taskbarProgressEnabled: z.boolean().default(true),
  // Server whose credentials live in the OS vault; used to restore the session
  // on startup. Stored here (not in the vault) so the vault stays keyed by URL.
  lastServerUrl: z.string().url().max(2048).nullable().default(null),
  // Existing explicit opt-ins are preserved when loading saved settings.
  permitInsecureHttp: z.boolean().default(false),
  windowBounds: windowBoundsSchema.default(null),
  updateChannel: z.enum(['stable', 'beta']).default('stable'),
  aiDj: aiDjSettingsSchema.default(AI_DJ_SETTINGS_DEFAULTS),
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
