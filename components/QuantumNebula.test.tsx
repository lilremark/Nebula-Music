// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuantumNebula } from './QuantumNebula';

describe('QuantumNebula', () => {
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
    // jsdom lacks WebGL2 / 2D canvas implementations; returning null verifies graceful fallback
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

  it('mounts cleanly and responds to interactive pointer gestures without throwing', async () => {
    await act(async () => root.render(<QuantumNebula />));

    const stage = container.querySelector('[data-nebula-quantum-scene="true"]') as HTMLDivElement | null;
    expect(stage).not.toBeNull();
    expect(stage?.querySelector('canvas')).not.toBeNull();

    // Pointer interaction switches cursor state while holding and restores on release
    await act(async () => {
      stage!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 120, clientY: 80 }));
    });
    expect(stage?.className).toContain('cursor-grabbing');

    await act(async () => {
      stage!.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 0, clientX: 120, clientY: 80 }));
    });
    expect(stage?.className).not.toContain('cursor-grabbing');
  });
});
