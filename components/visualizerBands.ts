export const getFrequencyBin = (frequency: number, sampleRate: number, binCount: number): number => {
  const nyquist = sampleRate / 2;
  return Math.min(binCount - 1, Math.max(0, Math.floor((frequency / nyquist) * binCount)));
};

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.min(max, Math.max(min, value));

export const getFrequencyBands = (
  data: Uint8Array,
  count: number,
  previous: number[],
  sampleRate: number,
): number[] => {
  const bands = new Array(count);
  const minHz = 28;
  const maxHz = Math.min(20000, sampleRate * 0.48);
  const minLog = Math.log(minHz);
  const maxLog = Math.log(maxHz);

  for (let i = 0; i < count; i++) {
    const startHz = Math.exp(minLog + (i / count) * (maxLog - minLog));
    const endHz = Math.exp(minLog + ((i + 1) / count) * (maxLog - minLog));
    const start = getFrequencyBin(startHz, sampleRate, data.length);
    const end = Math.min(data.length, Math.max(start + 1, getFrequencyBin(endHz, sampleRate, data.length) + 1));
    let sum = 0;
    for (let bin = start; bin < end; bin++) sum += data[bin];
    const raw = sum / (end - start) / 255;
    // Softer than the old 0.58-exponent + 1.5x high-frequency lift: a mild
    // curve with no permanent treble boost keeps quiet highs responsive.
    const boosted = clamp(Math.pow(raw, 0.7));
    const oldValue = previous[i] ?? 0;
    // Gentle attack/release only; the analyser smoothing is lowered to ~0.5
    // in ensureDspGraph so transients are not doubly-smoothed.
    const smoothing = boosted > oldValue ? 0.35 : 0.15;
    bands[i] = oldValue + (boosted - oldValue) * smoothing;
  }

  return bands;
};

/** Map a 0..1 position across the log-spaced band axis to a band index. */
export const getBandForPosition = (position: number, count: number): number =>
  clamp(Math.floor(position * (count - 1)), 0, count - 1);
