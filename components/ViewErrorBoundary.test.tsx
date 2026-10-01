// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { ViewErrorBoundary } from './ViewErrorBoundary';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps playback mounted when a route fails and recovers after navigation', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const disposePlayback = vi.fn();
  const Playback = () => { useEffect(() => disposePlayback, []); return <button>Pause playback</button>; };
  const BrokenView = () => { throw new Error('Failed to fetch dynamically imported module'); };
  const container = document.createElement('div');
  const root = createRoot(container);
  try {
    await act(async () => root.render(<><Playback /><ViewErrorBoundary key="settings"><BrokenView /></ViewErrorBoundary></>));
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('This view could not load');
    expect(container.textContent).toContain('Pause playback');
    expect(disposePlayback).not.toHaveBeenCalled();
    await act(async () => root.render(<><Playback /><ViewErrorBoundary key="home"><p>Home loaded</p></ViewErrorBoundary></>));
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.textContent).toContain('Home loaded');
    expect(disposePlayback).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); }
});
