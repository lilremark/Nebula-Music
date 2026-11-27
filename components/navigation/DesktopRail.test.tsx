// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopRail } from './DesktopRail';

const { store } = vi.hoisted(() => ({ store: {} as Record<string, any> }));
vi.mock('../../context/Store', () => ({ useStore: () => store }));
vi.mock('../../platform/PlatformContext', () => ({ usePlatform: () => null }));
vi.mock('./ServerConnectionStatus', () => ({ ServerConnectionStatus: () => null }));

const baseSidebar = { collapsed: false, showHome: true, showBrowse: true, showRadio: true, showArtists: true, showAlbums: true, showSongs: true, showPlaylists: true, sections: { discover: true, library: true, playlists: true } };
const playlists = Array.from({ length: 9 }, (_, index) => ({ id: `p${index + 1}`, name: `Playlist ${index + 1}`, songCount: 0, duration: 0, created: '' }));

let container: HTMLDivElement;
let root: Root;
let collapsed = false;

const render = async () => {
  await act(async () => root.render(<DesktopRail collapsed={collapsed} onToggle={() => {}} />));
};

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  collapsed = false;
  Object.assign(store, {
    currentView: 'HOME',
    viewData: undefined,
    playlists,
    settings: { sidebar: structuredClone(baseSidebar) },
    service: { getCoverArtUrl: (id: string) => `cover:${id}` },
    setView: vi.fn(),
    openSearchModal: vi.fn(),
    createPlaylist: vi.fn(),
    // Mirror Store.updateSettings' shallow sidebar replacement, then re-render like a context update.
    updateSettings: vi.fn((patch: { sidebar?: typeof baseSidebar }) => {
      store.settings = { ...store.settings, ...patch, sidebar: { ...store.settings.sidebar, ...(patch.sidebar || {}) } };
    }),
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const heading = (label: string) => [...container.querySelectorAll<HTMLButtonElement>('.nebula-rail-disclosure')].find(button => button.querySelector('.nebula-rail-disclosure-label')?.textContent === label)!;
const groupOf = (button: HTMLButtonElement) => document.getElementById(button.getAttribute('aria-controls')!)!;

describe('DesktopRail disclosure sections', () => {
  it('renders each group heading as a disclosure button wired to its items', async () => {
    await render();
    for (const label of ['Discover', 'Your Library', 'Playlists']) {
      const button = heading(label);
      expect(button.getAttribute('aria-expanded')).toBe('true');
      const group = groupOf(button);
      expect(group.dataset.open).toBe('true');
      expect(group.hasAttribute('inert')).toBe(false);
    }
  });

  it('collapses a group, hides its items from interaction and persists through updateSettings', async () => {
    await render();
    await act(async () => heading('Your Library').click());
    expect(store.updateSettings).toHaveBeenCalledWith({ sidebar: expect.objectContaining({ collapsed: false, sections: { discover: true, library: false, playlists: true } }) });
    await render();
    const button = heading('Your Library');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    const group = groupOf(button);
    expect(group.dataset.open).toBe('false');
    expect(group.hasAttribute('inert')).toBe(true);
    expect(group.querySelector('[aria-label="Artists"]')).not.toBeNull();
    // Collapsing Library adds a route to every playlist at the end of the playlist list.
    expect(container.querySelector('.nebula-rail-all-playlists')?.textContent).toBe('All playlists');
  });

  it('loads settings saved before sections existed with every group expanded', async () => {
    const { sections: _omitted, ...legacy } = baseSidebar;
    store.settings = { sidebar: legacy };
    await render();
    for (const label of ['Discover', 'Your Library', 'Playlists']) expect(heading(label).getAttribute('aria-expanded')).toBe('true');
  });

  it('marks a collapsed heading that contains the current page', async () => {
    store.currentView = 'ALBUM_DETAIL';
    store.settings.sidebar.sections.library = false;
    await render();
    expect(heading('Your Library').querySelector('[data-nebula-rail-active-marker]')).not.toBeNull();
    expect(heading('Discover').querySelector('[data-nebula-rail-active-marker]')).toBeNull();
    store.settings.sidebar.sections.library = true;
    await render();
    expect(heading('Your Library').querySelector('[data-nebula-rail-active-marker]')).toBeNull();
  });

  it('lists every playlist with a title and count instead of capping at four', async () => {
    await render();
    const rows = [...container.querySelectorAll<HTMLButtonElement>('.nebula-rail-playlist')];
    expect(rows).toHaveLength(9);
    expect(rows[8].title).toBe('Playlist 9');
    expect(heading('Playlists').querySelector('.nebula-rail-heading-count')?.textContent).toBe('9');
  });

  it('marks the open playlist row instead of the Library Playlists item', async () => {
    store.currentView = 'PLAYLIST_DETAIL';
    store.viewData = 'p3';
    await render();
    const row = container.querySelector<HTMLButtonElement>('.nebula-rail-playlist[aria-label="Playlist 3"]')!;
    expect(row.getAttribute('aria-current')).toBe('page');
    expect(row.dataset.active).toBe('true');
    expect(container.querySelector('.nebula-rail-item[aria-label="Playlists"]')?.getAttribute('aria-current')).toBeNull();
  });

  it('shows every nav icon in the icon rail regardless of collapsed groups', async () => {
    collapsed = true;
    store.settings.sidebar.sections = { discover: false, library: false, playlists: false };
    await render();
    for (const group of container.querySelectorAll<HTMLElement>('.nebula-rail-group')) {
      expect(group.dataset.open).toBe('true');
      expect(group.hasAttribute('inert')).toBe(false);
    }
    expect(container.querySelectorAll('[data-nebula-rail-divider]')).toHaveLength(3);
    expect(container.querySelector('.nebula-rail-all-playlists')).toBeNull();
  });

  it('creates a playlist from the heading + button', async () => {
    await render();
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="New playlist"]')!.click());
    const input = container.querySelector<HTMLInputElement>('[aria-label="New playlist name"]')!;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '  Road Trip ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => input.form!.requestSubmit());
    expect(store.createPlaylist).toHaveBeenCalledTimes(1);
    expect(store.createPlaylist).toHaveBeenCalledWith('Road Trip');
    expect(container.querySelector('[aria-label="New playlist name"]')).toBeNull();
  });
});
