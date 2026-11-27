/** @vitest-environment jsdom */

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '../platform/PlatformContext';
import { StoreProvider, useStore } from './Store';
import { db } from '../services/db';
import { APPEARANCE_STORAGE_KEY } from '../theme/applyAppearance';

vi.mock('../platform/desktop', async () => {
  const { createWebPlatform } = await import('../platform/web');
  return { createDesktopPlatform: () => createWebPlatform() };
});

vi.mock('../services/db', () => ({
  db: {
    init: vi.fn(async () => undefined),
    addListeningEvent: vi.fn(async () => undefined),
    getListeningEvents: vi.fn(async () => []),
    getMostPlayed: vi.fn(async () => []),
    get: vi.fn(async () => null),
    getCredentials: vi.fn(async () => null),
    saveCredentials: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    set: vi.fn(async () => undefined),
    clear: vi.fn(async () => undefined),
  },
}));

type Store = ReturnType<typeof useStore>;

describe('StoreProvider appearance settings', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latestStore: Store | undefined;

  const Probe = () => {
    latestStore = useStore();
    return null;
  };

  const mountStore = async () => {
    await act(async () => {
      root.render(<PlatformProvider><StoreProvider><Probe /></StoreProvider></PlatformProvider>);
    });
    for (let attempt = 0; attempt < 10 && !latestStore?.isInitialized; attempt += 1) {
      await act(async () => Promise.resolve());
    }
    expect(latestStore?.isInitialized).toBe(true);
  };

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    latestStore = undefined;
    localStorage.clear();
    document.documentElement.removeAttribute('data-nebula-theme');
    document.documentElement.removeAttribute('data-nebula-background');
    document.documentElement.style.removeProperty('--nebula-font');
    document.head.querySelectorAll('link[data-nebula-font-link]').forEach(link => link.remove());
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('loads settings saved before appearance existed with default appearance', async () => {
    vi.mocked(db.get).mockResolvedValueOnce({ theme: { primaryColor: '#112233', secondaryColor: '#445566', backgroundColor: '#000000' } });
    await mountStore();
    expect(latestStore!.settings.theme).toEqual({
      primaryColor: '#112233', secondaryColor: '#445566', backgroundColor: '#000000',
      preset: 'default', font: 'manrope', background: 'none',
    });
    expect(document.documentElement.hasAttribute('data-nebula-theme')).toBe(false);
  });

  it('replaces removed ids from saved settings and applies valid ones to <html>', async () => {
    vi.mocked(db.get).mockResolvedValueOnce({ theme: { preset: 'vaporwave', font: 'space-grotesk', background: 'aurora' } });
    await mountStore();
    expect(latestStore!.settings.theme).toMatchObject({ preset: 'default', font: 'space-grotesk', background: 'aurora' });
    expect(latestStore!.settings.theme.primaryColor).toMatch(/^#/);
    expect(document.documentElement.getAttribute('data-nebula-background')).toBe('aurora');
  });

  it('merges appearance updates key by key and mirrors them to localStorage', async () => {
    await mountStore();
    await act(async () => latestStore!.updateSettings({ theme: { ...latestStore!.settings.theme, preset: 'terminal' } }));
    await act(async () => latestStore!.updateSettings({ theme: { ...latestStore!.settings.theme, font: 'inter' } }));
    expect(latestStore!.settings.theme).toMatchObject({ preset: 'terminal', font: 'inter', background: 'none' });
    expect(document.documentElement.getAttribute('data-nebula-theme')).toBe('terminal');
    expect(JSON.parse(localStorage.getItem(APPEARANCE_STORAGE_KEY)!)).toEqual({ preset: 'terminal', font: 'inter', background: 'none' });
  });
});
