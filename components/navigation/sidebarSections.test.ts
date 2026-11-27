import { describe, expect, it } from 'vitest';
import type { AppSettings } from '../../types';
import { activeSidebarSection, DEFAULT_SIDEBAR_SECTIONS, openPlaylistId, resolveSidebarSections, toggleSidebarSection } from './sidebarSections';

const sidebar = (sections?: Partial<AppSettings['sidebar']['sections']>): AppSettings['sidebar'] => ({
  collapsed: false, showHome: true, showBrowse: true, showRadio: true, showArtists: true, showAlbums: true, showSongs: true, showPlaylists: true,
  ...(sections ? { sections: sections as AppSettings['sidebar']['sections'] } : {}),
}) as AppSettings['sidebar'];

describe('sidebar section state', () => {
  it('expands every group for settings saved before sections existed', () => {
    expect(resolveSidebarSections(sidebar())).toEqual(DEFAULT_SIDEBAR_SECTIONS);
    expect(resolveSidebarSections(undefined)).toEqual({ discover: true, library: true, playlists: true });
    expect(resolveSidebarSections(sidebar({ library: false }))).toEqual({ discover: true, library: false, playlists: true });
  });

  it('flips one group and keeps the other sidebar settings', () => {
    const next = toggleSidebarSection({ ...sidebar(), collapsed: true }, 'library');
    expect(next.collapsed).toBe(true);
    expect(next.sections).toEqual({ discover: true, library: false, playlists: true });
    expect(toggleSidebarSection(next, 'library').sections.library).toBe(true);
  });
});

describe('active sidebar section', () => {
  it('reads playlist ids from rail navigation and mix objects from Browse', () => {
    expect(openPlaylistId('PLAYLIST_DETAIL', 'p1')).toBe('p1');
    expect(openPlaylistId('PLAYLIST_DETAIL', { id: 'mix-1', name: 'Mix' })).toBe('mix-1');
    expect(openPlaylistId('ALBUM_DETAIL', 'p1')).toBeUndefined();
    expect(openPlaylistId('PLAYLIST_DETAIL', null)).toBeUndefined();
  });

  it('maps views to the group that holds their row', () => {
    expect(activeSidebarSection('HOME', undefined, [])).toBe('discover');
    expect(activeSidebarSection('RADIO', undefined, [])).toBe('discover');
    expect(activeSidebarSection('ALBUM_DETAIL', 'a1', [])).toBe('library');
    expect(activeSidebarSection('PLAYLIST_DETAIL', 'p1', ['p1'])).toBe('playlists');
    // A playlist without a rail row (e.g. a Browse mix) is reached through Library > Playlists.
    expect(activeSidebarSection('PLAYLIST_DETAIL', { id: 'mix' }, ['p1'])).toBe('library');
    expect(activeSidebarSection('SETTINGS', undefined, ['p1'])).toBeUndefined();
  });
});
