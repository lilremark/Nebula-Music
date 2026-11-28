// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SetupScreen } from './SetupScreen';

const connectToSubsonic = vi.fn(async () => true);
const enableDemoMode = vi.fn();

vi.mock('../context/Store', () => ({
  useStore: () => ({ connectToSubsonic, enableDemoMode }),
}));

vi.mock('./window/WindowControls', () => ({
  WindowControls: () => <div data-testid="window-controls" />,
}));

vi.mock('../hooks/useInsecureHttpSetting', () => ({
  isInsecureHttpUrl: () => false,
  useInsecureHttpSetting: () => ({
    allowInsecureHttp: false,
    setAllowInsecureHttp: vi.fn(),
    canConnect: () => true,
  }),
}));

describe('SetupScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mounts the interactive Quantum Nebula on the left alongside the sign-in card', async () => {
    await act(async () => root.render(<SetupScreen />));

    const scene = container.querySelector('[data-nebula-quantum-scene="true"]');
    expect(scene).not.toBeNull();
    // Left container must allow pointer events for interactivity
    expect(scene?.parentElement?.className).not.toContain('pointer-events-none');

    // Sign-in form remains intact
    expect(container.textContent).toContain('Sign in to Nebula');
    expect(container.querySelector('#setup-server-url')).not.toBeNull();
    expect(container.querySelector('#setup-username')).not.toBeNull();
    expect(container.querySelector('#setup-password')).not.toBeNull();
  });
});
