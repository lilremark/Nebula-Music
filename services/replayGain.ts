import type { ReplayGainInfo, ReplayGainSettings } from '../types';

export const DEFAULT_REPLAY_GAIN: ReplayGainSettings = {
  mode: 'off', preampDb: 0, preventClipping: true,
};

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export function normalizeReplayGainSettings(value: unknown): ReplayGainSettings {
  const saved = value && typeof value === 'object' ? value as Partial<ReplayGainSettings> : {};
  return {
    mode: saved.mode === 'track' || saved.mode === 'album' ? saved.mode : 'off',
    preampDb: finite(saved.preampDb) ? Math.max(-12, Math.min(12, saved.preampDb)) : 0,
    preventClipping: typeof saved.preventClipping === 'boolean' ? saved.preventClipping : true,
  };
}

export function parseReplayGain(value: unknown): ReplayGainInfo | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const result: ReplayGainInfo = {};
  for (const key of ['trackGain', 'albumGain', 'trackPeak', 'albumPeak', 'baseGain', 'fallbackGain'] as const) {
    const field = raw[key];
    if (finite(field) && (!key.endsWith('Peak') || field > 0)) result[key] = field;
  }
  return result;
}

export function getReplayGain(info: ReplayGainInfo | undefined, preferences: ReplayGainSettings): number {
  const settings = normalizeReplayGainSettings(preferences);
  if (settings.mode === 'off') return 1;
  const tags = parseReplayGain(info);
  if (!tags) return 1;
  const album = settings.mode === 'album';
  const gainDb = (album ? tags.albumGain ?? tags.trackGain : tags.trackGain ?? tags.albumGain) ?? tags.fallbackGain;
  if (gainDb === undefined) return 1;
  // Bound corrupt server values before converting dB to amplitude.
  const gain = 10 ** (Math.max(-60, Math.min(24, gainDb + settings.preampDb)) / 20);
  const peak = album ? tags.albumPeak ?? tags.trackPeak : tags.trackPeak ?? tags.albumPeak;
  return settings.preventClipping && peak ? Math.min(gain, 1 / peak) : gain;
}

export function applyReplayGain(node: GainNode, info: ReplayGainInfo | undefined, settings: ReplayGainSettings, now: number, immediate = false): void {
  const gain = getReplayGain(info, settings);
  if (immediate) {
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(gain, now);
  } else {
    if (typeof node.gain.cancelAndHoldAtTime === 'function') node.gain.cancelAndHoldAtTime(now);
    else node.gain.cancelScheduledValues(now);
    node.gain.setTargetAtTime(gain, now, 0.015);
  }
}
