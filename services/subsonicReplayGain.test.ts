import { describe, expect, it } from 'vitest';
import { SubsonicService } from './subsonicService';

describe('Subsonic ReplayGain metadata', () => {
  it('preserves gain and peak fields in songs returned by the server', async () => {
    const service = new SubsonicService({ serverUrl: 'https://music.example', username: 'test', token: 'test', salt: 'test' });
    const replayGain = { trackGain: -6, albumGain: -4, trackPeak: 0.99, albumPeak: 1.1, baseGain: 0, fallbackGain: -8 };
    service.setTransport({
      resolveMediaUrl: url => url,
      fetchJson: async () => ({ ok: true, status: 200, statusText: '', body: {
        'subsonic-response': { status: 'ok', randomSongs: { song: [
          { id: 'tagged', title: 'Tagged', replayGain },
          { id: 'legacy', title: 'Legacy' },
          { id: 'invalid', title: 'Invalid', replayGain: { trackGain: 'oops', trackPeak: -1 } },
        ] } },
      } }),
    });
    const songs = await service.getRandomSongs();
    expect(songs[0].replayGain).toEqual(replayGain);
    expect(songs[1].replayGain).toBeUndefined();
    expect(songs[2].replayGain).toEqual({});
  });
});
