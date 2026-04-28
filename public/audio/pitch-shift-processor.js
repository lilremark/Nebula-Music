class NebulaPitchShiftProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      {
        name: 'semitones',
        defaultValue: 0,
        minValue: -12,
        maxValue: 12,
        automationRate: 'k-rate',
      },
    ];
  }

  constructor() {
    super();
    this.bufferLength = Math.max(16384, Math.ceil(sampleRate * 0.75));
    this.grainSize = Math.ceil(sampleRate * 0.09);
    this.minDelay = Math.ceil(sampleRate * 0.018);
    this.writeIndex = 0;
    this.phase = 0;
    this.buffers = [
      new Float32Array(this.bufferLength),
      new Float32Array(this.bufferLength),
    ];
  }

  readSample(channel, delaySamples) {
    const buffer = this.buffers[channel] || this.buffers[0];
    let readIndex = this.writeIndex - delaySamples;
    while (readIndex < 0) readIndex += this.bufferLength;
    readIndex %= this.bufferLength;

    const indexA = Math.floor(readIndex);
    const indexB = (indexA + 1) % this.bufferLength;
    const fraction = readIndex - indexA;
    return buffer[indexA] * (1 - fraction) + buffer[indexB] * fraction;
  }

  getDelayForPhase(phase, ratio) {
    if (ratio >= 1) {
      return this.minDelay + (1 - phase) * this.grainSize;
    }
    return this.minDelay + phase * this.grainSize;
  }

  getWindow(phase) {
    return 1 - Math.abs(phase * 2 - 1);
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    if (!input || input.length === 0 || !output || output.length === 0) return true;

    const semitones = parameters.semitones[0] || 0;
    const ratio = Math.pow(2, semitones / 12);
    const shiftAmount = Math.abs(ratio - 1);
    const channelCount = Math.min(output.length, Math.max(input.length, 1), 2);
    const frameCount = output[0].length;

    for (let i = 0; i < frameCount; i += 1) {
      for (let channel = 0; channel < channelCount; channel += 1) {
        const inputChannel = input[channel] || input[0];
        const sample = inputChannel ? inputChannel[i] || 0 : 0;
        this.buffers[channel][this.writeIndex] = sample;

        if (Math.abs(semitones) < 0.01) {
          output[channel][i] = sample;
        } else {
          const phaseA = this.phase;
          const phaseB = (this.phase + 0.5) % 1;
          const windowA = this.getWindow(phaseA);
          const windowB = this.getWindow(phaseB);
          const sampleA = this.readSample(channel, this.getDelayForPhase(phaseA, ratio));
          const sampleB = this.readSample(channel, this.getDelayForPhase(phaseB, ratio));
          output[channel][i] = (sampleA * windowA + sampleB * windowB) / Math.max(0.001, windowA + windowB);
        }
      }

      for (let channel = channelCount; channel < output.length; channel += 1) {
        output[channel][i] = output[0][i] || 0;
      }

      this.writeIndex = (this.writeIndex + 1) % this.bufferLength;
      if (shiftAmount > 0.0001) {
        this.phase = (this.phase + shiftAmount / this.grainSize) % 1;
      }
    }

    return true;
  }
}

registerProcessor('nebula-pitch-shift', NebulaPitchShiftProcessor);
