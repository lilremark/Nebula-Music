import { AVAILABLE_DJ_VOICES, DEFAULT_DJ_VOICE } from '../settingsSchema';

export { DEFAULT_DJ_VOICE, AVAILABLE_DJ_VOICES };
export type DjVoiceId = (typeof AVAILABLE_DJ_VOICES)[number] | (string & {});

export interface SpeechSynthesisResult {
  wavBytes: Uint8Array;
}

export interface SpeechSynth {
  synthesize(text: string, voiceId: string): Promise<SpeechSynthesisResult>;
}

export interface SpeechAudioDestination {
  play(wavBytes: Uint8Array): void;
  stop(): void;
}

export interface DjSpeechController {
  speak(text: string, voiceId?: string): Promise<void>;
  cancel(): void;
  dispose(): void;
}

export class SpeechError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpeechError';
  }
}

export interface DjSpeechControllerOptions {
  synth: SpeechSynth;
  player: SpeechAudioDestination;
  getVoice?: () => string;
}

/**
 * Injectable DJ speech controller. Synthesis and playback are fully
 * injected, so tests can provide fakes and the real engine (echogarden +
 * onnxruntime-node) is only required in the Electron main process.
 *
 * Non-blocking: `speak` is async and does not block callers. A new `speak`
 * call cancels/supersedes any in-flight synthesis or playback so only the
 * latest line is heard. Cancellation is generation-based so stale synth
 * completions that resolve late are ignored.
 */
export const createDjSpeechController = (options: DjSpeechControllerOptions): DjSpeechController => {
  const { synth, player, getVoice } = options;
  let generation = 0;
  let activeGeneration = 0;
  let disposed = false;

  const cancelInternal = (): void => {
    activeGeneration = 0;
    generation += 1;
    player.stop();
  };

  return {
    async speak(text: string, voiceId?: string): Promise<void> {
      if (disposed) throw new SpeechError('DJ speech controller is disposed.');
      const trimmed = text.trim();
      if (!trimmed) return;
      const voice = voiceId ?? getVoice?.() ?? DEFAULT_DJ_VOICE;
      generation += 1;
      const gen = generation;
      activeGeneration = gen;
      // Stop any current playback immediately; new line supersedes.
      player.stop();
      let result: SpeechSynthesisResult;
      try {
        result = await synth.synthesize(trimmed, voice);
      } catch (error) {
        // If this generation was superseded while synthesizing, swallow the
        // error so a cancelled stale request does not surface.
        if (gen !== activeGeneration) return;
        throw error instanceof Error ? error : new SpeechError(String(error));
      }
      if (gen !== activeGeneration || disposed) return;
      if (!result?.wavBytes || result.wavBytes.length === 0) {
        throw new SpeechError('Synthesis produced no audio.');
      }
      player.play(result.wavBytes);
    },

    cancel(): void {
      if (disposed) return;
      cancelInternal();
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;
      activeGeneration = 0;
      generation += 1;
      player.stop();
    },
  };
};

/**
 * Simple in-memory synth/player helpers for tests. Not used in production.
 */
export const createFakeSynth = (wavBytes: Uint8Array = new Uint8Array([1, 2, 3])): SpeechSynth & { calls: { text: string; voiceId: string }[] } => {
  const calls: { text: string; voiceId: string }[] = [];
  return {
    calls,
    async synthesize(text: string, voiceId: string): Promise<SpeechSynthesisResult> {
      calls.push({ text, voiceId });
      return { wavBytes };
    },
  };
};
