import { describe, expect, it } from 'vitest';
import {
  cancelCoverArtLoad,
  completeCoverArtLoad,
  startCoverArtLoad,
  type CoverArtLoadState,
} from './coverArtLoadState';

describe('cover art load state', () => {
  it('starts the same song again after a pending Strict Mode setup is cancelled', () => {
    let state: CoverArtLoadState = { status: 'idle' };

    state = startCoverArtLoad(state, 'song-1', 1);
    expect(state).toEqual({ status: 'pending', songId: 'song-1', requestId: 1 });

    state = cancelCoverArtLoad(state, 1);
    expect(state).toEqual({ status: 'idle' });

    state = startCoverArtLoad(state, 'song-1', 2);
    expect(state).toEqual({ status: 'pending', songId: 'song-1', requestId: 2 });
  });

  it('ignores completion from a cancelled request after the same song restarts', () => {
    let state: CoverArtLoadState = startCoverArtLoad({ status: 'idle' }, 'song-1', 1);
    state = cancelCoverArtLoad(state, 1);
    state = startCoverArtLoad(state, 'song-1', 2);

    expect(completeCoverArtLoad(state, 1, 'data:image/jpeg;base64,/9j/2Q==')).toBe(state);
  });

  it('keeps completed artwork cached when its effect cleans up', () => {
    let state: CoverArtLoadState = startCoverArtLoad({ status: 'idle' }, 'song-1', 1);
    state = completeCoverArtLoad(state, 1, 'data:image/jpeg;base64,/9j/2Q==');

    expect(cancelCoverArtLoad(state, 1)).toBe(state);
    expect(startCoverArtLoad(state, 'song-1', 2)).toBe(state);
  });

  it('deduplicates setup while the same song is pending', () => {
    const state = startCoverArtLoad({ status: 'idle' }, 'song-1', 1);
    expect(startCoverArtLoad(state, 'song-1', 2)).toBe(state);
  });
});
