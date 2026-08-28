import { describe, expect, it } from 'vitest';
import { IPC } from './ipc';

describe('IPC channel names', () => {
  it('keeps channel names namespaced and unique across groups', () => {
    const all = Object.values(IPC).flatMap((group) => Object.values(group as Record<string, string>));
    expect(all.length).toBe(new Set(all).size);
  });

  it('exposes the shared channel constants used by preload and main', () => {
    expect(IPC.settings.get).toBe('nebula:settings:get');
    expect(IPC.settings.set).toBe('nebula:settings:set');
    expect(IPC.window.minimize).toBe('nebula:window:minimize');
    expect(IPC.window.close).toBe('nebula:window:close');
    expect(IPC.playback.command).toBe('nebula:playback:command');
    expect(IPC.updater.status).toBe('nebula:updater:status');
    expect(IPC.app.info).toBe('nebula:app:info');
  });
});
