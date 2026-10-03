import { useEffect, useState } from 'react';

export function readSpeechEnergy(analyser: AnalyserNode, samples: Uint8Array<ArrayBuffer>): number {
  analyser.getByteTimeDomainData(samples);
  let sum = 0;
  for (const sample of samples) sum += ((sample - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

export function useSpeechEnergy(analyser: AnalyserNode | null, playing: boolean) {
  const [energy, setEnergy] = useState(0);
  useEffect(() => {
    if (!analyser || !playing) { setEnergy(0); return; }
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0, last = 0, smoothed = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      if (time - last < 50) return;
      last = time;
      smoothed += (readSpeechEnergy(analyser, samples) - smoothed) * 0.35;
      setEnergy(smoothed);
    };
    const refresh = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === 'visible') frame = requestAnimationFrame(draw);
      else setEnergy(0);
    };
    document.addEventListener('visibilitychange', refresh); refresh();
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', refresh); };
  }, [analyser, playing]);
  return energy;
}
