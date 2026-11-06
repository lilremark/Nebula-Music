import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};
const getSnapshot = () => document.visibilityState !== 'hidden';
const getServerSnapshot = () => true;

/**
 * True while the document is visible. Animation loops should depend on this
 * and stop entirely when hidden: Electron windows run with
 * backgroundThrottling disabled, so an idle requestAnimationFrame loop would
 * otherwise keep waking the CPU at display rate while the app sits in the tray.
 */
export const useDocumentVisible = (): boolean => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
