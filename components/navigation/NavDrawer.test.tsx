// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { NavDrawer } from './NavDrawer';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, any> }));
vi.mock('../../context/Store', () => ({ useStore: () => store }));
vi.mock('../../platform/PlatformContext', () => ({ usePlatform: () => null }));
vi.mock('./ServerConnectionStatus', () => ({ ServerConnectionStatus: () => null }));

describe('NavDrawer disclosure sections', () => {
  it('shares the persisted section state with the desktop rail', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.assign(store, {
      currentView: 'SONGS', viewData: undefined,
      playlists: Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, name: `Mix ${index}` })),
      settings: { sidebar: { collapsed: false, showHome: true, showBrowse: true, showRadio: true, showArtists: true, showAlbums: true, showSongs: true, showPlaylists: true, sections: { discover: true, library: false, playlists: true } } },
      service: { getCoverArtUrl: () => '' },
      setView: vi.fn(), openSearchModal: vi.fn(), updateSettings: vi.fn(),
    });
    const container = document.createElement('div');
    const root = createRoot(container);
    try {
      await act(async () => root.render(<NavDrawer isOpen onClose={() => {}} />));
      const buttons = [...container.querySelectorAll<HTMLButtonElement>('.nebula-drawer-disclosure')];
      expect(buttons.map(button => button.getAttribute('aria-expanded'))).toEqual(['true', 'false', 'true']);
      const library = buttons[1];
      expect(container.querySelector(`#${library.getAttribute('aria-controls')}`)?.hasAttribute('inert')).toBe(true);
      // Songs is active inside the collapsed Library group.
      expect(library.querySelector('[data-nebula-rail-active-marker]')).not.toBeNull();
      // The drawer scrolls, so it lists every playlist plus the All playlists route while Library is collapsed.
      expect(container.querySelectorAll('.nebula-drawer-playlist')).toHaveLength(11);
      await act(async () => library.click());
      expect(store.updateSettings).toHaveBeenCalledWith({ sidebar: expect.objectContaining({ sections: { discover: true, library: true, playlists: true } }) });
    } finally {
      await act(async () => root.unmount());
      vi.unstubAllGlobals();
    }
  });
});
