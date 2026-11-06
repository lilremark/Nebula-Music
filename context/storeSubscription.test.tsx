// @vitest-environment jsdom
import React, { act, createContext, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createStoreHandle, usePublishStoreValue, useStableCallbacks, useStableObject, useTrackedStore, type StoreHandle,
} from './storeSubscription';

interface Value { count: number; label: string; increment: () => void; rename: (label: string) => void; read: () => number }
const Ctx = createContext<StoreHandle<Value> | undefined>(undefined);
const useValue = () => useTrackedStore(Ctx, 'useValue');

let api: Value;
const Provider = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);
  const [label, setLabel] = useState('a');
  // Inline closures over current state, like the real Store's actions.
  const actions = useStableCallbacks({ increment: () => setCount(count + 1), read: () => count });
  const value: Value = { count, label, increment: actions.increment, read: actions.read, rename: setLabel };
  const [handle] = useState(() => createStoreHandle(value));
  usePublishStoreValue(handle, value);
  api = value;
  return <Ctx.Provider value={handle}>{children}</Ctx.Provider>;
};

const renders = { count: 0, label: 0 };
const CountReader = () => { renders.count += 1; const { count } = useValue(); return <span data-count>{count}</span>; };
const LabelReader = () => { renders.label += 1; const { label } = useValue(); return <span data-label>{label}</span>; };

describe('tracked store subscription', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    root = createRoot(container);
    renders.count = 0; renders.label = 0;
    await act(async () => root.render(<Provider><CountReader /><LabelReader /></Provider>));
  });
  afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); });

  it('re-renders only components that read the changed key', async () => {
    const before = { ...renders };
    await act(async () => api.increment());
    expect(container.querySelector('[data-count]')!.textContent).toBe('1');
    expect(renders.count).toBe(before.count + 1);
    expect(renders.label).toBe(before.label);
    await act(async () => api.rename('b'));
    expect(container.querySelector('[data-label]')!.textContent).toBe('b');
    expect(renders.count).toBe(before.count + 1);
  });

  it('keeps action identities stable while calling the latest closure', async () => {
    const { increment, read } = api;
    await act(async () => increment());
    await act(async () => increment());
    expect(api.increment).toBe(increment);
    expect(read()).toBe(2);
    expect(container.querySelector('[data-count]')!.textContent).toBe('2');
  });

  it('returns the latest value from reads made after render', async () => {
    let captured: Value | undefined;
    const Capture = () => { captured = useValue(); return null; };
    await act(async () => root.render(<Provider><Capture /></Provider>));
    await act(async () => api.rename('later'));
    expect(captured!.label).toBe('later');
  });

  it('throws outside the provider', () => {
    const Orphan = () => { useValue(); return null; };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => act(() => createRoot(document.createElement('div')).render(<Orphan />))).toThrow('useValue must be used within StoreProvider');
    spy.mockRestore();
  });
});

describe('useStableObject', () => {
  it('keeps identity until data changes and wraps functions around the latest closure', async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    const root = createRoot(document.createElement('div'));
    let result: any;
    const Probe = ({ n, tag }: { n: number; tag: string }) => {
      result = useStableObject({ n, presentation: { tag }, get: () => n });
      return null;
    };
    await act(async () => root.render(<Probe n={1} tag="x" />));
    const first = result;
    await act(async () => root.render(<Probe n={1} tag="x" />));
    expect(result).toBe(first);
    await act(async () => root.render(<Probe n={2} tag="x" />));
    expect(result).not.toBe(first);
    expect(result.get).toBe(first.get);
    expect(first.get()).toBe(2);
    const second = result;
    await act(async () => root.render(<Probe n={2} tag="y" />));
    expect(result).not.toBe(second);
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  });
});
