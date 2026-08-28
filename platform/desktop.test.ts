import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopPlatform } from './desktop';

const desktopBridge = {
  info: { os: 'win32', appName: 'Nebula', appVersion: '2.5.0' },
  window: { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), isMaximized: vi.fn(), isFullScreen: vi.fn(), onMaximizeChanged: vi.fn() },
  settings: { get: vi.fn(), set: vi.fn() },
  vault: { get: vi.fn(), set: vi.fn(), clear: vi.fn(), getSecret: vi.fn(), setSecret: vi.fn(), clearSecret: vi.fn() },
  playback: { onCommand: vi.fn(), publishSnapshot: vi.fn(), onSnapshot: vi.fn(), sendCommand: vi.fn() },
  http: { fetchJson: vi.fn(), proxyUrl: vi.fn((u) => `app://nebula/proxy?u=${encodeURIComponent(u)}`) },
  app: { onOpenSettings: vi.fn() },
  power: { onResumed: vi.fn() },
  openExternal: vi.fn(),
  miniPlayer: { toggle: vi.fn(), showMain: vi.fn() },
  updater: { getState: vi.fn(), check: vi.fn(), installAndRestart: vi.fn(), openDownloadPage: vi.fn(), onStatus: vi.fn() },
  aiDj: undefined,
};

beforeEach(() => { vi.stubGlobal('window', { desktop: desktopBridge }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('createDesktopPlatform', () => {
  it('throws when window.desktop is absent', () => {
    // Re-stub to no bridge for this assertion.
    const prev = (globalThis as any).window;
    (globalThis as any).window = {};
    expect(() => createDesktopPlatform()).toThrow(/requires window\.desktop/);
    (globalThis as any).window = prev;
  });

  it('maps platform info and media URL routing', () => {
    const p = createDesktopPlatform();
    expect(p.info).toEqual({ kind: 'desktop', os: 'win32', appName: 'Nebula', appVersion: '2.5.0' });
    expect(p.resolveMediaUrl('https://m/track.mp3')).toBe('https://m/track.mp3');
    expect(p.resolveMediaUrl('http://m/track.mp3')).toContain('/proxy?u=');
    expect(p.resolveMediaUrl('')).toBe('');
  });

  it('wires window/settings/playback/vault methods to the bridge', () => {
    const p = createDesktopPlatform();
    p.window.minimize();
    p.settings.set('k', 'v');
    p.playback.sendCommand({} as any);
    p.vault.set({} as any);
    expect(desktopBridge.window.minimize).toHaveBeenCalled();
    expect(desktopBridge.settings.set).toHaveBeenCalledWith('k', 'v');
    expect(desktopBridge.playback.sendCommand).toHaveBeenCalled();
    expect(desktopBridge.vault.set).toHaveBeenCalled();
  });
});
