import type { DesktopSnapshot } from './desktopProtocol';

export const getPlaybackMenuKey = (snapshot: DesktopSnapshot | null): string =>
  JSON.stringify([
    snapshot?.track?.id ?? null,
    snapshot?.playing ?? false,
    Boolean(snapshot?.track?.coverArtUrl),
  ]);
