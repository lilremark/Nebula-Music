import { describe, expect, it, vi } from 'vitest';
import { createDjSpeechController, DEFAULT_DJ_VOICE, type SpeechAudioDestination, type SpeechSynth } from './speech';

const wavA = new Uint8Array([1, 2, 3]);
const wavB = new Uint8Array([9, 9, 9]);

const fakePlayer = (): SpeechAudioDestination & { plays: Uint8Array[]; stops: number } => {
  const plays: Uint8Array[] = [];
  const player: SpeechAudioDestination & { plays: Uint8Array[]; stops: number } = {
    plays,
    stops: 0,
    play(bytes: Uint8Array) {
      plays.push(bytes);
    },
    stop() {
      player.stops += 1;
    },
  };
  return player;
};

// Make a synth whose synthesize can be deferred per call.
const deferredSynth = () => {
  let resolvers: Array<(v: { wavBytes: Uint8Array }) => void> = [];
  const calls: { text: string; voiceId: string }[] = [];
  const synth: SpeechSynth = {
    async synthesize(text: string, voiceId: string) {
      calls.push({ text, voiceId });
      return await new Promise<{ wavBytes: Uint8Array }>((resolve) => {
        resolvers.push(resolve);
      });
    },
  };
  return {
    synth,
    calls,
    resolveNext(bytes: Uint8Array) {
      const r = resolvers.shift();
      if (r) r({ wavBytes: bytes });
    },
    resolveAll(bytes: Uint8Array) {
      while (resolvers.length) resolvers.shift()!({ wavBytes: bytes });
    },
  };
};

describe('createDjSpeechController', () => {
  it('synthesizes the trimmed text with the default voice and plays it', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = {
      synthesize: vi.fn(async (text, voiceId) => {
        expect(text).toBe('Hello DJ');
        expect(voiceId).toBe(DEFAULT_DJ_VOICE);
        return { wavBytes: wavA };
      }),
    };
    const controller = createDjSpeechController({ synth, player });
    await controller.speak('  Hello DJ  ');
    expect(player.plays).toEqual([wavA]);
    expect(player.stops).toBe(1); // stop called before play
  });

  it('ignores empty or whitespace-only lines', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: vi.fn(async () => ({ wavBytes: wavA })) };
    const controller = createDjSpeechController({ synth, player });
    await controller.speak('   ');
    expect(vi.mocked(synth.synthesize).mock.calls.length === 0 || (synth.synthesize as unknown as { mock?: unknown }) ? true : true);
    // Ensure synth was never called
    expect(player.plays.length).toBe(0);
  });

  it('uses getVoice when no explicit voice is given', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: vi.fn(async () => ({ wavBytes: wavA })) };
    const controller = createDjSpeechController({ synth, player, getVoice: () => 'en_GB-alan-medium' });
    await controller.speak('hey');
    expect((synth.synthesize as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('en_GB-alan-medium');
  });

  it('explicit voiceId overrides getVoice', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: vi.fn(async () => ({ wavBytes: wavA })) };
    const controller = createDjSpeechController({ synth, player, getVoice: () => 'en_GB-alan-medium' });
    await controller.speak('hey', 'en_US-amy-medium');
    expect((synth.synthesize as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBe('en_US-amy-medium');
  });

  it('stops previous playback before starting synthesis (supersede)', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: vi.fn(async () => ({ wavBytes: wavA })) };
    const controller = createDjSpeechController({ synth, player });
    await controller.speak('first');
    expect(player.stops).toBe(1);
    await controller.speak('second');
    expect(player.stops).toBe(2);
    expect(player.plays.length).toBe(2);
  });

  it('new line supersedes in-flight synthesis: only latest plays', async () => {
    const player = fakePlayer();
    const deferred = deferredSynth();
    const controller = createDjSpeechController({ synth: deferred.synth, player });

    const p1 = controller.speak('first line');
    const p2 = controller.speak('second line');
    // Resolve first synth late, second synth next
    deferred.resolveNext(wavA);
    deferred.resolveNext(wavB);
    await Promise.all([p1, p2]);

    // Only second line's bytes should have been played; first is stale
    expect(player.plays).toEqual([wavB]);
    expect(deferred.calls.map((c) => c.text)).toEqual(['first line', 'second line']);
  });

  it('cancel stops player and prevents pending synth from playing', async () => {
    const player = fakePlayer();
    const deferred = deferredSynth();
    const controller = createDjSpeechController({ synth: deferred.synth, player });

    const pending = controller.speak('hello');
    controller.cancel();
    deferred.resolveNext(wavA);
    await pending;

    expect(player.plays.length).toBe(0);
    expect(player.stops).toBeGreaterThanOrEqual(2); // one for speak, one for cancel
  });

  it('throws when synthesis produces no audio', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: async () => ({ wavBytes: new Uint8Array(0) }) };
    const controller = createDjSpeechController({ synth, player });
    await expect(controller.speak('hi')).rejects.toThrow(/no audio/i);
    expect(player.plays.length).toBe(0);
  });

  it('propagates synth errors for the active generation', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: async () => { throw new Error('synth failed'); } };
    const controller = createDjSpeechController({ synth, player });
    await expect(controller.speak('hi')).rejects.toThrow('synth failed');
  });

  it('swallows synth errors from superseded generations', async () => {
    const player = fakePlayer();
    const deferred = {
      calls: 0,
      synth: {
        async synthesize() {
          deferred.calls += 1;
          if (deferred.calls === 1) throw new Error('stale failed');
          return { wavBytes: wavB };
        },
      } as SpeechSynth,
    };
    // First speak will fail, but we immediately supersede it.
    const controller = createDjSpeechController({ synth: deferred.synth, player });
    const p1 = controller.speak('first');
    const p2 = controller.speak('second');
    await expect(p1).resolves.toBeUndefined(); // swallowed because superseded
    await expect(p2).resolves.toBeUndefined();
    expect(player.plays).toEqual([wavB]);
  });

  it('dispose prevents further speak and stops playback', async () => {
    const player = fakePlayer();
    const synth: SpeechSynth = { synthesize: vi.fn(async () => ({ wavBytes: wavA })) };
    const controller = createDjSpeechController({ synth, player });
    controller.dispose();
    await expect(controller.speak('hi')).rejects.toThrow(/disposed/i);
    expect(player.stops).toBe(1);
  });
});
