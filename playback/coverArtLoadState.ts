export type CoverArtLoadState =
  | { status: 'idle' }
  | { status: 'pending'; songId: string; requestId: number }
  | { status: 'completed'; songId: string; dataUrl?: string };

export const startCoverArtLoad = (
  state: CoverArtLoadState,
  songId: string,
  requestId: number,
): CoverArtLoadState => {
  if (state.status !== 'idle' && state.songId === songId) return state;
  return { status: 'pending', songId, requestId };
};

export const cancelCoverArtLoad = (
  state: CoverArtLoadState,
  requestId: number,
): CoverArtLoadState =>
  state.status === 'pending' && state.requestId === requestId ? { status: 'idle' } : state;

export const completeCoverArtLoad = (
  state: CoverArtLoadState,
  requestId: number,
  dataUrl: string | undefined,
): CoverArtLoadState =>
  state.status === 'pending' && state.requestId === requestId
    ? { status: 'completed', songId: state.songId, dataUrl }
    : state;
