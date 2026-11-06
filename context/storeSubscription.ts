import { useContext, useLayoutEffect, useMemo, useReducer, useRef, useState, type Context } from 'react';

type AnyFn = (...args: any[]) => any;
type Listener<T> = (prev: T, next: T) => void;

/**
 * Holds the Store's latest committed value outside React's context value, so
 * the context itself never changes and consumers re-render only for keys they
 * actually read (see {@link useTrackedStore}).
 */
export interface StoreHandle<T extends object> {
  latest: T;
  listeners: Set<Listener<T>>;
}

export const createStoreHandle = <T extends object>(initial: T): StoreHandle<T> => ({
  latest: initial,
  listeners: new Set(),
});

/**
 * Publishes a new Store value after commit. Child layout effects (which
 * subscribe) run before this parent effect, so no consumer misses an update.
 */
export const usePublishStoreValue = <T extends object>(handle: StoreHandle<T>, value: T): void => {
  useLayoutEffect(() => {
    const prev = handle.latest;
    handle.latest = value;
    if (prev === value) return;
    for (const listener of handle.listeners) listener(prev, value);
  });
};

/**
 * Returns stable function identities that always call the latest closure.
 * Used for Store actions defined inline, which would otherwise be new on
 * every Store render and force every consumer to re-render with them.
 */
export const useStableCallbacks = <T extends Record<string, AnyFn>>(fns: T): T => {
  const latest = useRef(fns);
  latest.current = fns;
  const [stable] = useState(() => {
    const out: Record<string, AnyFn> = {};
    for (const key of Object.keys(fns)) out[key] = (...args: unknown[]) => latest.current[key](...args);
    return out as T;
  });
  return stable;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(key => Object.prototype.hasOwnProperty.call(b, key) && Object.is(a[key], b[key]));
};

/**
 * Keeps an object's identity stable while its data is unchanged. Function
 * fields become stable wrappers around the latest closure and are ignored for
 * comparison; plain-object fields are compared one level deep (e.g. a
 * presentation object rebuilt every render from the same values).
 */
export const useStableObject = <T extends Record<string, unknown>>(value: T): T => {
  const latest = useRef(value);
  latest.current = value;
  const wrappers = useRef(new Map<string, AnyFn>());
  const previous = useRef<T | null>(null);

  const prev = previous.current;
  if (prev) {
    const keys = Object.keys(value);
    const unchanged = keys.length === Object.keys(prev).length && keys.every(key => {
      const next = value[key];
      const before = prev[key];
      if (typeof next === 'function') return typeof before === 'function';
      if (isPlainObject(next) && isPlainObject(before)) return shallowEqual(next, before);
      return Object.is(next, before);
    });
    if (unchanged) return prev;
  }

  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (typeof field === 'function') {
      let wrapper = wrappers.current.get(key);
      if (!wrapper) {
        wrapper = (...args: unknown[]) => (latest.current[key] as AnyFn)(...args);
        wrappers.current.set(key, wrapper);
      }
      out[key] = wrapper;
    } else {
      out[key] = field;
    }
  }
  previous.current = out as T;
  return out as T;
};

/**
 * Reads the Store through a proxy that records which keys this component
 * accesses, and re-renders it only when one of those keys changes identity.
 * Reads always return the latest committed value, so callbacks never observe
 * stale Store data even when the component has not re-rendered.
 */
export const useTrackedStore = <T extends object>(
  context: Context<StoreHandle<T> | undefined>,
  hookName: string,
): T => {
  const handle = useContext(context);
  if (!handle) throw new Error(`${hookName} must be used within StoreProvider`);
  const [, forceRender] = useReducer((count: number) => count + 1, 0);
  const tracked = useRef(new Set<PropertyKey>());

  useLayoutEffect(() => {
    const listener: Listener<T> = (prev, next) => {
      for (const key of tracked.current) {
        if (!Object.is((prev as any)[key], (next as any)[key])) {
          forceRender();
          return;
        }
      }
    };
    handle.listeners.add(listener);
    return () => { handle.listeners.delete(listener); };
  }, [handle]);

  return useMemo(() => {
    const trackAll = () => { for (const key of Reflect.ownKeys(handle.latest)) tracked.current.add(key); };
    return new Proxy({} as T, {
      get: (_target, key) => {
        tracked.current.add(key);
        return (handle.latest as any)[key];
      },
      has: (_target, key) => {
        tracked.current.add(key);
        return key in handle.latest;
      },
      ownKeys: () => {
        trackAll();
        return Reflect.ownKeys(handle.latest);
      },
      getOwnPropertyDescriptor: (_target, key) => {
        tracked.current.add(key);
        const descriptor = Reflect.getOwnPropertyDescriptor(handle.latest, key);
        return descriptor ? { ...descriptor, configurable: true } : undefined;
      },
    });
  }, [handle]);
};
