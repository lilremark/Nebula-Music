import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { motion, useIsPresent } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

// Both surfaces read the same preference, including changes while switching.
const reducedMotionSnapshot = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const subscribeReducedMotion = (sync: () => void) => {
  const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  media?.addEventListener('change', sync);
  return () => media?.removeEventListener('change', sync);
};

/** Presentation only: the Store continues to own playback throughout a switch. */
export function PlayerSurface({ kind, className, children }: {
  kind: 'sidebar' | 'dock'; className: string; children: React.ReactNode;
}) {
  const present = useIsPresent();
  const reduced = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, () => true);
  const root = useRef<HTMLElement>(null);
  const sidebar = kind === 'sidebar';
  // Read before the DOM commit makes the outgoing controls inert and blurs them.
  const transferFocus = !present && !!root.current?.contains(document.activeElement);
  useLayoutEffect(() => {
    if (!transferFocus) return;
    const selector = sidebar ? '[aria-label="Open now playing panel"]' : '[aria-label="Collapse now playing panel"]';
    document.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true });
  }, [transferFocus, sidebar]);
  const Component = sidebar ? motion.aside : motion.footer;
  return <Component
    ref={root}
    className={className}
    data-nebula-player-surface={kind}
    data-player-exiting={!present || undefined}
    data-nebula-panel={sidebar ? 'now-playing' : undefined}
    aria-label={sidebar ? 'Now playing' : 'Playback controls'}
    aria-hidden={!present || undefined}
    inert={!present}
    style={sidebar ? undefined : { x: '-50%' }}
    initial={reduced ? false : sidebar ? { opacity: 0 } : { y: 24, opacity: 0 }}
    animate={sidebar ? { opacity: 1 } : { y: 0, opacity: 1 }}
    exit={sidebar ? { opacity: 0 } : { y: 28, opacity: 0 }}
    transition={reduced ? { duration: 0 } : {
      duration: present ? 0.36 : 0.28, ease,
      opacity: { duration: present ? 0.22 : sidebar ? 0.28 : 0.14, delay: present ? 0.1 : 0 },
      ...(sidebar ? {} : { y: { duration: present ? 0.32 : 0.22, ease } }),
    }}
  >{children}</Component>;
}
