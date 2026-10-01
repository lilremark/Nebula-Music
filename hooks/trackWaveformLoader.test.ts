import { describe, expect, it } from 'vitest';
import { createTrackWaveformLoader } from './trackWaveformLoader';

describe('createTrackWaveformLoader', () => {
  it('keeps a connection available for playback across successive tracks', async () => {
    const maxConnections = 6;
    let activeConnections = 0;

    const openConnection = (signal?: AbortSignal): Promise<number[]> => {
      if (activeConnections >= maxConnections) {
        return Promise.reject(new Error('connection pool exhausted'));
      }

      if (!signal) return Promise.resolve([]);

      activeConnections += 1;
      return new Promise<number[]>((_resolve, reject) => {
        signal?.addEventListener(
          'abort',
          () => {
            activeConnections -= 1;
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    };

    const loader = createTrackWaveformLoader((_streamUrl, signal) => openConnection(signal));
    let current: ReturnType<typeof loader.subscribe> | undefined;

    for (let track = 1; track <= 6; track += 1) {
      current?.release();
      current = loader.subscribe(`track-${track}`, `https://music.example/stream?id=${track}`);
      void current.promise.catch(() => undefined);
    }

    await expect(openConnection()).resolves.toEqual(expect.any(Array));
    current?.release();
  });

  it('keeps a shared request alive until its final subscriber releases it', async () => {
    let requestSignal: AbortSignal | undefined;
    const loader = createTrackWaveformLoader((_streamUrl, signal) => {
      requestSignal = signal;
      return new Promise<number[]>((_resolve, reject) => {
        signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    });

    const first = loader.subscribe('shared-track', 'https://music.example/stream?id=shared');
    const second = loader.subscribe('shared-track', 'https://music.example/stream?id=shared');
    void first.promise.catch(() => undefined);

    first.release();
    const afterFirstRelease = requestSignal?.aborted;
    second.release();

    expect([afterFirstRelease, requestSignal?.aborted]).toEqual([false, true]);
  });
});
