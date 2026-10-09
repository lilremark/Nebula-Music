// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { ServerConnectionStatus } from './ServerConnectionStatus';

const { store } = vi.hoisted(() => ({ store: { credentials: null as any, isDemoMode: false } }));
vi.mock('../../context/Store', () => ({ useStore: () => store }));

const renderStatus = async (credentials: any, isDemoMode = false) => {
  Object.assign(store, { credentials, isDemoMode });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<ServerConnectionStatus />));
    return container.innerHTML;
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
};

describe('sidebar server identification', () => {
  it('shows the host, port and server path without exposing authentication data', async () => {
    const html = await renderStatus({ serverUrl: 'https://alice:supersecret@music.example:8443/subsonic/?apiKey=sensitive#token' });
    expect(html).toContain('Connected to server');
    expect(html).toContain('music.example:8443/subsonic');
    for (const secret of ['alice', 'supersecret', 'apiKey', 'sensitive', '#token']) expect(html).not.toContain(secret);
  });

  it('identifies demo mode without showing the configured account server', async () => {
    const html = await renderStatus({ serverUrl: 'https://private.example/' }, true);
    expect(html).toContain('Demo library');
    expect(html).not.toContain('private.example');
    expect(html).not.toContain('Connected to server');
  });

  it('shows offline when no server is configured', async () => {
    const html = await renderStatus(null);
    expect(html).toContain('Offline');
    expect(html).not.toContain('Connected to server');
  });
});
