export interface TrackWaveformSubscription<T> {
  promise: Promise<T>;
  release(): void;
}

interface InFlightTrackWaveform<T> {
  controller: AbortController;
  promise: Promise<T>;
  subscribers: number;
  settled: boolean;
}

export const createTrackWaveformLoader = <T>(
  load: (streamUrl: string, signal: AbortSignal) => Promise<T>,
) => {
  const inFlight = new Map<string, InFlightTrackWaveform<T>>();

  const subscribe = (cacheKey: string, streamUrl: string): TrackWaveformSubscription<T> => {
    let entry = inFlight.get(cacheKey);

    if (!entry) {
      const controller = new AbortController();
      const task = load(streamUrl, controller.signal);
      const created: InFlightTrackWaveform<T> = {
        controller,
        promise: task,
        subscribers: 0,
        settled: false,
      };

      created.promise = task.finally(() => {
        created.settled = true;
        if (inFlight.get(cacheKey) === created) inFlight.delete(cacheKey);
      });
      entry = created;
      inFlight.set(cacheKey, created);
    }

    entry.subscribers += 1;
    let released = false;

    return {
      promise: entry.promise,
      release: () => {
        if (released) return;
        released = true;
        entry.subscribers -= 1;

        if (entry.subscribers === 0 && !entry.settled) {
          if (inFlight.get(cacheKey) === entry) inFlight.delete(cacheKey);
          entry.controller.abort();
        }
      },
    };
  };

  return { subscribe };
};
