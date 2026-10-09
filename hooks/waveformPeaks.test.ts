import { describe, expect, it } from 'vitest';
import { buildWaveformPeaks } from './waveformPeaks';

describe('waveform channel energy', () => {
    it('preserves opposite-phase stereo and quiet passages', () => {
        const left = new Float32Array([0.5, -0.5, 0.05, -0.05]);
        const right = left.map(value => -value);
        const mono = buildWaveformPeaks([left], 2);
        expect(buildWaveformPeaks([left, right], 2)).toEqual(mono);
        expect(mono[0]).toBe(1);
        expect(mono[1]).toBeGreaterThan(0);
        expect(mono[1]).toBeLessThan(0.3);
    });
    it('includes the final sample of uneven windows without inventing silence peaks', () => {
        expect(buildWaveformPeaks([new Float32Array([0, 0, 0, 0, 1])], 2)).toEqual([0, 1]);
        expect(buildWaveformPeaks([new Float32Array(7)], 3)).toEqual([0, 0, 0]);
        expect(buildWaveformPeaks([], 3)).toEqual([0, 0, 0]);
    });
});
