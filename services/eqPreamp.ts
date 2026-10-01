import type { AppSettings } from '../types';

type EqualizerSettings = AppSettings['eq'];

// Keep corrupt or out-of-range saved profiles from producing unsafe gain values.
export const getAutoEqPreampDb = (eq: EqualizerSettings): number => {
  if (eq.preset !== 'custom') return 0;
  const value = eq.autoEq?.preamp;
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(12, Math.max(-60, value))
    : 0;
};

export const getEqPreampGain = (eq: EqualizerSettings): number =>
  eq.enabled ? 10 ** (getAutoEqPreampDb(eq) / 20) : 1;

export const applyEqPreamp = (node: GainNode, eq: EqualizerSettings, now: number): void => {
  // Hold the current ramp when changing profiles so rapid changes do not click.
  if (typeof node.gain.cancelAndHoldAtTime === 'function') {
    node.gain.cancelAndHoldAtTime(now);
  } else {
    node.gain.cancelScheduledValues(now);
  }
  node.gain.setTargetAtTime(getEqPreampGain(eq), now, 0.015);
};
