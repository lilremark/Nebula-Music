// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installWindowVisibility } from './windowVisibility';

describe('installWindowVisibility', () => {
  let uninstall: (() => void) | undefined;
  afterEach(() => uninstall?.());

  const install = () => {
    let push: (visible: boolean) => void = () => {};
    const unsubscribe = vi.fn();
    uninstall = installWindowVisibility(handler => {
      push = handler;
      handler(true);
      return unsubscribe;
    });
    return { push: (visible: boolean) => push(visible), unsubscribe };
  };

  it('reports hidden and notifies listeners while the window is off screen', () => {
    const { push } = install();
    const onChange = vi.fn(() => document.visibilityState);
    document.addEventListener('visibilitychange', onChange);

    expect(document.visibilityState).toBe('visible');
    push(false);
    expect(document.visibilityState).toBe('hidden');
    expect(document.hidden).toBe(true);
    expect(document.documentElement.hasAttribute('data-window-hidden')).toBe(true);
    expect(onChange).toHaveLastReturnedWith('hidden');

    push(true);
    expect(document.visibilityState).toBe('visible');
    expect(document.hidden).toBe(false);
    expect(document.documentElement.hasAttribute('data-window-hidden')).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(2);
    document.removeEventListener('visibilitychange', onChange);
  });

  it('ignores repeated states', () => {
    const { push } = install();
    const onChange = vi.fn();
    document.addEventListener('visibilitychange', onChange);
    push(true);
    push(false);
    push(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    document.removeEventListener('visibilitychange', onChange);
  });

  it('restores the native properties when uninstalled', () => {
    const { push, unsubscribe } = install();
    push(false);
    uninstall?.();
    uninstall = undefined;
    expect(unsubscribe).toHaveBeenCalled();
    expect(Object.prototype.hasOwnProperty.call(document, 'visibilityState')).toBe(false);
    expect(document.visibilityState).toBe('visible');
    expect(document.documentElement.hasAttribute('data-window-hidden')).toBe(false);
  });
});
