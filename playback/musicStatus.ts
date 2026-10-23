export type MusicPlaybackStatus = 'idle' | 'loading' | 'buffering' | 'error';

interface MediaStatusSource extends EventTarget {
  readonly paused: boolean;
  readonly readyState: number;
  readonly currentTime: number;
}

export const observeMusicStatus = <T extends MediaStatusSource>(
  sources: T[],
  getActiveSource: () => T | null,
  update: (status: MusicPlaybackStatus) => void,
) => {
  let failed = false;
  const loading = (audio: T) => update(audio.currentTime > 0 ? 'buffering' : 'loading');
  const listeners = sources.map(audio => {
    const onEvent = (event: Event) => {
      if (getActiveSource() !== audio) return;
      if (failed) return;
      switch (event.type) {
        case 'error': failed = true; update('error'); break;
        case 'pause':
        case 'ended': update('idle'); break;
        case 'waiting':
        case 'seeking':
        case 'loadstart': loading(audio); break;
        case 'stalled':
          if (audio.readyState < 3) loading(audio);
          break;
        case 'playing': update('idle'); break;
        case 'canplay':
        case 'seeked':
        case 'timeupdate':
          if (!audio.paused && audio.readyState >= 3) update('idle');
          break;
      }
    };
    const events = ['loadstart', 'waiting', 'stalled', 'seeking', 'playing', 'canplay', 'seeked', 'timeupdate', 'pause', 'ended', 'error'];
    events.forEach(event => audio.addEventListener(event, onEvent));
    return () => events.forEach(event => audio.removeEventListener(event, onEvent));
  });
  const active = getActiveSource();
  if (active && (active.paused || active.readyState < 3)) loading(active);
  else update('idle');
  return () => listeners.forEach(remove => remove());
};
