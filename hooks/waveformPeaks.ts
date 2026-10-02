export const WAVEFORM_SAMPLES = 320;

// Measure channel energy separately: opposite-phase stereo must not cancel.
export const buildWaveformPeaks = (channels: Float32Array[], count = WAVEFORM_SAMPLES): number[] => {
    const length = channels[0]?.length || 0;
    const peaks = Array.from({ length: count }, (_, index) => {
        const start = Math.floor(index * length / count);
        const end = Math.floor((index + 1) * length / count);
        let energy = 0;
        let maximum = 0;
        for (const channel of channels) {
            for (let sample = start; sample < end; sample += 1) {
                const value = channel[sample] || 0;
                energy += value * value;
                maximum = Math.max(maximum, Math.abs(value));
            }
        }
        const samples = (end - start) * channels.length;
        const rms = samples ? Math.sqrt(energy / samples) : 0;
        return Math.pow(rms * 0.8 + maximum * 0.2, 0.7);
    });
    const maximum = Math.max(...peaks, 0.001);
    return peaks.map(peak => peak / maximum);
};
