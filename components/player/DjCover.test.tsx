// @vitest-environment jsdom
import React, { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DjCover } from './DjCover';

const controls = vi.hoisted(() => ({ reduced: false, disposed: vi.fn(), props: null as any }));
vi.mock('framer-motion', () => ({ useReducedMotion: () => controls.reduced }));
vi.mock('../vendor/shadercn/components/orbs/orb-21', () => ({ Orb21: (props: any) => {
  controls.props = props;
  useEffect(() => () => controls.disposed(), []);
  return <canvas data-orb="21" />;
} }));

let container: HTMLDivElement, root: Root;
let intersect: (entries: { isIntersecting: boolean }[]) => void;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  controls.reduced = false; controls.disposed.mockClear(); controls.props = null;
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: {} });
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof intersect) { intersect = callback; }
    observe() {} disconnect() {}
  });
  container = document.createElement('div'); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const render = async (playing: boolean) => act(async () => root.render(<DjCover playing={playing} energy={0.4} />));

it('renders the pinned orb with actual volume input and releases it on pause', async () => {
  await render(true);
  expect(container.querySelector('canvas')).not.toBeNull();
  expect(controls.props.volumes).toEqual({ input: 0, output: 0.4 });
  expect(controls.props.maxDpr).toBe(1.5);
  await render(false);
  expect(container.querySelector('canvas')).toBeNull();
  expect(container.querySelector('img')).not.toBeNull();
  expect(controls.disposed).toHaveBeenCalledOnce();
});

it('uses static art for reduced motion and missing WebGPU', async () => {
  controls.reduced = true; await render(true);
  expect(container.querySelector('canvas')).toBeNull();
  controls.reduced = false;
  Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined });
  await render(true);
  expect(container.querySelector('[aria-label="AI DJ cover"] img')).not.toBeNull();
  expect(container.querySelector('canvas')).toBeNull();
});

it('releases rendering offscreen and while hidden, then resumes when visible', async () => {
  await render(true);
  await act(async () => intersect([{ isIntersecting: false }]));
  expect(container.querySelector('canvas')).toBeNull();
  await act(async () => intersect([{ isIntersecting: true }]));
  expect(container.querySelector('canvas')).not.toBeNull();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('canvas')).toBeNull();
});

it('keeps static cover after initialization failure or device loss', async () => {
  await render(true);
  await act(async () => controls.props.onError());
  expect(container.querySelector('canvas')).toBeNull();
  expect(container.querySelector('img')).not.toBeNull();
  await render(false); await render(true);
  expect(container.querySelector('canvas')).toBeNull();
});
