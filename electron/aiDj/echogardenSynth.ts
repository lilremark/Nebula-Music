import type { SpeechSynthesisResult, SpeechSynth } from './speech';
import { SpeechError } from './speech';

export interface EchogardenSynthOptions {
  /** Optional on-disk directory where echogarden caches models/voices. */
  cacheDir?: string;
}

/**
 * Create a real SpeechSynth backed by `echogarden` + `onnxruntime-node`.
 *
 * The voice model for `en_US-ryan-high` (~100-120MB) is downloaded on first
 * use via echogarden's internal package manager and cached locally so later
 * calls work offline. This factory is intentionally lazy: `echogarden` is
 * only imported when `synthesize` is first called, so tests can inject a
 * fake synth without having the native dependency installed.
 */
export const createEchogardenSynth = (options: EchogardenSynthOptions = {}): SpeechSynth => ({
  async synthesize(text: string, voiceId: string): Promise<SpeechSynthesisResult> {
    const trimmed = text.trim();
    if (!trimmed) throw new SpeechError('Cannot synthesize empty text.');
    if (!voiceId) throw new SpeechError('Voice id is required.');

    let echogarden: any;
    try {
      // @ts-ignore - optional dependency, installed only for desktop builds
      echogarden = await import('echogarden');
    } catch (error) {
      throw new SpeechError(
        `echogarden is not installed. Run: npm install echogarden onnxruntime-node --allow-scripts=onnxruntime-node,wtf_wikipedia --os=win32 --cpu=x64. ${String((error as Error)?.message ?? error)}`,
      );
    }

    // echogarden's package cache defaults to a per-user directory. When
    // running inside Electron we prefer the app's userData folder if provided
    // so the model lives next to settings/vault and is easy to clear.
    if (options.cacheDir) {
      try {
        // echogarden exposes a global cache path via its config; if unavailable
        // we at least ensure the directory exists — echogarden will still use
        // its own cache, but the directory is ready for manual caching.
        const { mkdir } = await import('node:fs/promises');
        await mkdir(options.cacheDir, { recursive: true });
      } catch {
        // non-fatal
      }
    }

    try {
      const result = await (echogarden as {
        synthesize: (
          input: string,
          synthOptions: Record<string, unknown>,
        ) => Promise<{ audio: unknown }>;
      }).synthesize(trimmed, {
        engine: 'vits',
        voice: voiceId,
        // Ask echogarden to return a WAV buffer directly when possible so we
        // can forward raw bytes over IPC without re-encoding.
        outputAudioFormat: { codec: 'wav' },
        // Non-blocking synthesis should be quick; we keep defaults for speed/pitch
        // and let the DJ persona be defined purely by voice selection.
        ...(options.cacheDir ? { cache: { path: options.cacheDir } } : {}),
      });

      const audio = (result as { audio?: unknown }).audio;

      if (audio instanceof Uint8Array) {
        return { wavBytes: audio };
      }
      if (audio instanceof Buffer) {
        return { wavBytes: new Uint8Array(audio) };
      }
      // RawAudio shape: { audioChannels: Float32Array[], sampleRate: number }
      if (audio && typeof audio === 'object' && 'audioChannels' in (audio as Record<string, unknown>)) {
        const raw = audio as { audioChannels: Float32Array[]; sampleRate: number };
        const wavBytes = encodeRawAudioToWav(raw);
        return { wavBytes };
      }
      throw new SpeechError('echogarden returned an unexpected audio format.');
    } catch (error) {
      if (error instanceof SpeechError) throw error;
      throw new SpeechError((error as Error)?.message ?? 'Speech synthesis failed.');
    }
  },
});

/**
 * Minimal WAV encoder for RawAudio. Used only when echogarden returns
 * Float32 channels instead of a pre-encoded WAV. 16-bit PCM, mono or
 * interleaved stereo.
 */
const encodeRawAudioToWav = (raw: { audioChannels: Float32Array[]; sampleRate: number }): Uint8Array => {
  const channels = raw.audioChannels.length;
  const sampleRate = raw.sampleRate || 22050;
  const length = raw.audioChannels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (s: string): void => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  };
  const writeUint32 = (v: number): void => {
    view.setUint32(offset, v, true);
    offset += 4;
  };
  const writeUint16 = (v: number): void => {
    view.setUint16(offset, v, true);
    offset += 2;
  };
  writeString('RIFF');
  writeUint32(36 + dataSize);
  writeString('WAVE');
  writeString('fmt ');
  writeUint32(16);
  writeUint16(1); // PCM
  writeUint16(channels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(16); // bits per sample
  writeString('data');
  writeUint32(dataSize);
  // Interleave and convert float32 [-1,1] to int16
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < channels; ch += 1) {
      const sample = raw.audioChannels[ch][i] ?? 0;
      const clamped = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }
  return new Uint8Array(buffer);
};
