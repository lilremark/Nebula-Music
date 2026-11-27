import type { AppSettings, SidebarSectionId, SidebarSectionState, View } from '../../types';

export const DEFAULT_SIDEBAR_SECTIONS: SidebarSectionState = { discover: true, library: true, playlists: true };

type SidebarSettings = AppSettings['sidebar'];

/** Saved settings from older builds have no `sections`; fill every missing group as expanded. */
export const resolveSidebarSections = (sidebar: Partial<SidebarSettings> | undefined): SidebarSectionState => ({
  ...DEFAULT_SIDEBAR_SECTIONS,
  ...(sidebar?.sections || {}),
});

/** The `sidebar` patch that flips one group, ready for `updateSettings({ sidebar })`. */
export const toggleSidebarSection = (sidebar: SidebarSettings, id: SidebarSectionId): SidebarSettings => {
  const sections = resolveSidebarSections(sidebar);
  return { ...sidebar, sections: { ...sections, [id]: !sections[id] } };
};

const DISCOVER_VIEWS: readonly View[] = ['HOME', 'BROWSE', 'AI_DJ', 'RADIO', 'SEARCH'];
const LIBRARY_VIEWS: readonly View[] = ['ARTISTS', 'ALBUMS', 'SONGS', 'PLAYLISTS', 'LIKED_SONGS', 'LIKED_ALBUMS', 'ARTIST_DETAIL', 'ALBUM_DETAIL', 'PLAYLIST_DETAIL'];

/** `setView('PLAYLIST_DETAIL', …)` receives a playlist id from the rail and Library, or a mix object from Browse. */
export const openPlaylistId = (view: View, viewData: unknown): string | undefined => {
  if (view !== 'PLAYLIST_DETAIL') return undefined;
  if (typeof viewData === 'string') return viewData;
  const id = (viewData as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' ? id : undefined;
};

/** Which navigation group holds the active row, so a collapsed heading can carry a marker. */
export const activeSidebarSection = (view: View, viewData: unknown, playlistIds: readonly string[]): SidebarSectionId | undefined => {
  const playlistId = openPlaylistId(view, viewData);
  if (playlistId && playlistIds.includes(playlistId)) return 'playlists';
  if (DISCOVER_VIEWS.includes(view)) return 'discover';
  if (LIBRARY_VIEWS.includes(view)) return 'library';
  return undefined;
};
