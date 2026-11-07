/**
 * The main window runs with `backgroundThrottling: false` (throttled timers
 * stalled live streams), which also makes Chromium report the page as visible
 * while the window is hidden to the tray or minimized. This makes
 * `document.visibilityState`/`document.hidden` also reflect the window's real
 * visibility and fires `visibilitychange` when it changes, so every existing
 * visibility check (render loops, progress renders, the DJ orb) pauses in the
 * tray. `html[data-window-hidden]` lets CSS pause infinite animations.
 *
 * Only page-level JavaScript sees the change: Chromium still treats the page
 * as visible, so audio, timers and requestAnimationFrame keep running.
 */
export const installWindowVisibility = (
  subscribe: (handler: (visible: boolean) => void) => () => void,
  doc: Document = document,
): (() => void) => {
  const proto = Object.getPrototypeOf(doc) as Document;
  const nativeState = findGetter(proto, 'visibilityState');
  const nativeHidden = findGetter(proto, 'hidden');
  let windowVisible = true;

  Object.defineProperty(doc, 'visibilityState', {
    configurable: true,
    get: () => (windowVisible ? nativeState.call(doc) : 'hidden'),
  });
  Object.defineProperty(doc, 'hidden', {
    configurable: true,
    get: () => !windowVisible || Boolean(nativeHidden.call(doc)),
  });

  const unsubscribe = subscribe(visible => {
    if (visible === windowVisible) return;
    windowVisible = visible;
    doc.documentElement.toggleAttribute('data-window-hidden', !visible);
    doc.dispatchEvent(new Event('visibilitychange'));
  });

  return () => {
    unsubscribe();
    delete (doc as unknown as Record<string, unknown>).visibilityState;
    delete (doc as unknown as Record<string, unknown>).hidden;
    doc.documentElement.removeAttribute('data-window-hidden');
  };
};

const findGetter = (start: object, key: string): ((this: Document) => unknown) => {
  for (let proto: object | null = start; proto; proto = Object.getPrototypeOf(proto)) {
    const getter = Object.getOwnPropertyDescriptor(proto, key)?.get;
    if (getter) return getter as (this: Document) => unknown;
  }
  throw new Error(`document.${key} has no getter`);
};
