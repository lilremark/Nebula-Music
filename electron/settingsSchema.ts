import { z } from 'zod';

export const windowBoundsSchema = z
  .object({
    width: z.number().int().min(320).max(16384),
    height: z.number().int().min(240).max(16384),
    x: z.number().int().optional(),
    y: z.number().int().optional(),
  })
  .nullable();

export const desktopSettingsSchema = z.object({
  schemaVersion: z.number().int().min(1).default(1),
  trayOnClose: z.boolean().default(true),
  minimizeToTray: z.boolean().default(false),
  mediaKeysEnabled: z.boolean().default(true),
  taskbarProgressEnabled: z.boolean().default(true),
  // Server whose credentials live in the OS vault; used to restore the session
  // on startup. Stored here (not in the vault) so the vault stays keyed by URL.
  lastServerUrl: z.string().url().max(2048).nullable().default(null),
  // Phase 1 is internal-only; the proxy permits plain HTTP Subsonic by default
  // and Phase 2 flips this to false with a per-server allowlist.
  permitInsecureHttp: z.boolean().default(true),
  windowBounds: windowBoundsSchema.default(null),
  updateChannel: z.enum(['stable', 'beta']).default('stable'),
});

export type DesktopSettings = z.infer<typeof desktopSettingsSchema>;

export const DESKTOP_SETTINGS_DEFAULTS: DesktopSettings = {
  schemaVersion: 1,
  trayOnClose: true,
  minimizeToTray: false,
  mediaKeysEnabled: true,
  taskbarProgressEnabled: true,
  lastServerUrl: null,
  permitInsecureHttp: true,
  windowBounds: null,
  updateChannel: 'stable',
};
