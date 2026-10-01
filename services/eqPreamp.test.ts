import { describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '../types';
import { applyEqPreamp, getAutoEqPreampDb, getEqPreampGain } from './eqPreamp';

const eq = (preamp?: number): AppSettings['eq'] => ({
  enabled: true, preset: 'custom',
  bands: { '32': 0, '64': 0, '125': 0, '250': 0, '500': 0, '1k': 0, '2k': 6, '4k': 0, '8k': 0, '16k': 0 },
  autoEq: { name: 'Test', source: 'Test', path: 'Test', appliedAt: 0, preamp },
});

describe('AutoEq preamp', () => {
  it('converts amplitude decibels to linear gain', () => {
    expect(getEqPreampGain(eq(-6))).toBeCloseTo(0.501187, 6);
    expect(getEqPreampGain(eq(3))).toBeCloseTo(1.412538, 6);
  });

  it('bypasses attenuation when EQ is disabled without losing the saved value', () => {
    const settings = { ...eq(-7), enabled: false };
    expect(getEqPreampGain(settings)).toBe(1);
    expect(getAutoEqPreampDb(settings)).toBe(-7);
    expect(getEqPreampGain({ ...settings, enabled: true })).toBeCloseTo(0.446684, 6);
  });

  it('uses unity for missing, cleared, or invalid preamps and legacy built-in presets', () => {
    for (const value of [undefined, NaN, Infinity, -Infinity, '-6' as unknown as number]) {
      expect(getEqPreampGain(eq(value))).toBe(1);
    }
    expect(getEqPreampGain({ ...eq(-6), autoEq: null })).toBe(1);
    expect(getEqPreampGain({ ...eq(-6), preset: 'flat' })).toBe(1);
  });

  it('bounds corrupt saved values to the supported -60 to +12 dB range', () => {
    expect(getAutoEqPreampDb(eq(-1e10))).toBe(-60);
    expect(getAutoEqPreampDb(eq(1e10))).toBe(12);
    expect(getEqPreampGain(eq(-1e10))).toBe(0.001);
    expect(getEqPreampGain(eq(1e10))).toBeCloseTo(3.981072, 6);
  });

  it('holds the current envelope and smoothly changes gain', () => {
    const gain = { cancelAndHoldAtTime: vi.fn(), setTargetAtTime: vi.fn() };
    applyEqPreamp({ gain } as unknown as GainNode, eq(-6), 7);
    expect(gain.cancelAndHoldAtTime).toHaveBeenCalledWith(7);
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(getEqPreampGain(eq(-6)), 7, 0.015);
  });

  it('supports browsers without cancelAndHoldAtTime', () => {
    const gain = { cancelScheduledValues: vi.fn(), setTargetAtTime: vi.fn() };
    applyEqPreamp({ gain } as unknown as GainNode, { ...eq(-6), enabled: false }, 3);
    expect(gain.cancelScheduledValues).toHaveBeenCalledWith(3);
    expect(gain.setTargetAtTime).toHaveBeenCalledWith(1, 3, 0.015);
  });
});
