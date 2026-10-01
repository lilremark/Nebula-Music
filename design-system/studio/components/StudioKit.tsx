import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowUp, CornerDownLeft, Pause, Play, Search, SearchX } from 'lucide-react';

/**
 * Studio-only component kit.
 * Sources adapted for Nebula's React/Vite runtime:
 * - RareUI Hook Sidebar: https://www.rareui.com/r/hook-sidebar.json
 * - RareUI Step Player: https://www.rareui.com/r/step-player.json
 * - Spectrum UI Command Search: https://ui.spectrumhq.in/r/command-search.json
 * - Spectrum UI Animated Switch: https://ui.spectrumhq.in/r/animated-switch.json
 * - Spell UI Spotify Card: https://github.com/xxtomm/spell-ui/blob/main/registry/spell-ui/spotify-card.tsx
 */

const cx = (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' ');

export type RailItem = { id: string; label: string; icon?: React.ReactNode };

export function StudioButton({
  variant = 'primary',
  secondary = false,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  secondary?: boolean;
}) {
  return <button {...props} className={cx('studio-action', className)} data-variant={secondary ? 'secondary' : variant}>{children}</button>;
}

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Focus containment shared by every Studio overlay. It also makes the
 * background inert and restores focus to the invoking control on close. */
export function useDialogFocus<T extends HTMLElement>(open: boolean, onClose: () => void, initialFocus: 'first' | 'container' = 'first') {
  const containerRef = useRef<T>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!open || !container) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(container.parentElement?.children ?? [])
      .filter(node => node !== container && node instanceof HTMLElement) as HTMLElement[];
    const previous = siblings.map(element => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }));
    siblings.forEach(element => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFirst = () => (initialFocus === 'container' ? container : container.querySelector<HTMLElement>('[autofocus]') ?? container.querySelector<HTMLElement>(focusableSelector) ?? container).focus();
    const frame = requestAnimationFrame(focusFirst);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
        .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
      if (!focusable.length) { event.preventDefault(); container.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      });
      previousFocusRef.current?.focus();
    };
  }, [initialFocus, onClose, open]);

  return containerRef;
}

function Rail({ y, visible, subtle = false }: { y: number | null; visible: boolean; subtle?: boolean }) {
  const reduced = useReducedMotion();
  return <motion.span
    aria-hidden
    initial={false}
    animate={{ opacity: visible && y !== null ? 1 : 0 }}
    transition={{ duration: reduced ? 0 : .16 }}
    className={cx('kit-hook-rail', subtle && 'is-subtle')}
  >
    <motion.span
      initial={false}
      animate={{ height: Math.max(0, (y ?? 0) - 5) }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: .7 }}
      className="kit-hook-rail-line"
    />
    <motion.svg
      initial={false}
      animate={{ top: (y ?? 0) - 6 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: .7 }}
      width="13" height="8" viewBox="0 0 13 8" fill="none" className="kit-hook-rail-corner"
    >
      <path d="M.5 0a6.5 6.5 0 0 0 6.5 6.5H13" stroke="currentColor" strokeDasharray="2 2" />
    </motion.svg>
  </motion.span>;
}

export function HookNavigation({ items, value, onChange, label }: {
  items: RailItem[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [centers, setCenters] = useState<number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const active = items.findIndex(item => item.id === value);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => setCenters(itemRefs.current.map(node => node ? node.offsetTop + node.offsetHeight / 2 : 0));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items.length]);

  return <nav className="kit-hook-nav" aria-label={label}>
    {label && <p className="kit-hook-label">{label}</p>}
    <div ref={listRef} className="kit-hook-list" onMouseLeave={() => setHover(null)}>
      <Rail y={hover === null ? null : centers[hover] ?? null} visible={hover !== null && hover !== active} subtle />
      <Rail y={active >= 0 ? centers[active] ?? null : null} visible={active >= 0} />
      {items.map((item, index) => <button
        key={item.id}
        ref={node => { itemRefs.current[index] = node; }}
        type="button"
        className="kit-hook-item"
        data-active={item.id === value}
        aria-current={item.id === value ? 'page' : undefined}
        onMouseEnter={() => setHover(index)}
        onFocus={() => setHover(index)}
        onBlur={() => setHover(null)}
        onClick={() => onChange(item.id)}
      >
        {item.icon && <span className="kit-hook-icon">{item.icon}</span>}
        <span>{item.label}</span>
      </button>)}
    </div>
  </nav>;
}

export function AnimatedSwitch({ checked, onCheckedChange, label, disabled = false }: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const [pressed, setPressed] = useState(false);
  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    className="kit-switch"
    data-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    onPointerDown={() => setPressed(true)}
    onPointerUp={() => setPressed(false)}
    onPointerCancel={() => setPressed(false)}
    onPointerLeave={() => setPressed(false)}
  >
    <motion.span
      aria-hidden
      className="kit-switch-knob"
      initial={false}
      animate={{ x: checked ? 20 : 0, width: pressed && !reduced ? 23 : 18 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
    />
  </button>;
}

export function StepPlayer({ value, count, playing, progress, onValueChange, onPlayingChange }: {
  value: number;
  count: number;
  playing: boolean;
  progress: number;
  onValueChange: (value: number) => void;
  onPlayingChange: (playing: boolean) => void;
}) {
  const reduced = useReducedMotion();
  return <div className="kit-step-player" aria-label={`Featured track ${value + 1} of ${count}`}>
    <button type="button" className="kit-step-control" onClick={() => onPlayingChange(!playing)} aria-label={playing ? 'Pause featured tracks' : 'Resume featured tracks'}>
      {playing ? <Pause /> : <Play />}
    </button>
    <div className="kit-step-track">
      {Array.from({ length: count }, (_, index) => {
        const active = index === value;
        return <motion.button
          type="button"
          key={index}
          className="kit-step"
          data-active={active}
          data-complete={index < value}
          aria-label={`Show featured track ${index + 1}`}
          onClick={() => onValueChange(index)}
          animate={{ width: active ? 74 : 8 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 31 }}
        >
          <span className="kit-step-visual">
            {active && <span className="kit-step-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }} />}
          </span>
        </motion.button>;
      })}
    </div>
  </div>;
}

export type CommandItem = { id: string; label: string; hint?: string; icon?: React.ReactNode; action: () => void };
export type CommandGroup = { label: string; items: CommandItem[] };

export function CommandSearch({ open, onClose, groups, onSearch }: {
  open: boolean;
  onClose: () => void;
  groups: CommandGroup[];
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const layerRef = useDialogFocus<HTMLDivElement>(open, onClose);
  const reduced = useReducedMotion();
  const filtered = useMemo(() => groups.map(group => ({
    ...group,
    items: group.items.filter(item => `${item.label} ${item.hint ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())),
  })).filter(group => group.items.length), [groups, query]);
  const flat = filtered.flatMap(group => group.items);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const select = useCallback((item?: CommandItem) => {
    if (!item) return;
    item.action();
    onClose();
    setQuery('');
  }, [onClose]);

  const submitSearch = () => {
    const clean = query.trim();
    if (!clean) return;
    onSearch(clean);
    onClose();
    setQuery('');
  };

  return <AnimatePresence>
    {open && <motion.div ref={layerRef} className="kit-command-layer" initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <motion.div
        role="dialog" aria-modal="true" aria-label="Search Nebula"
        className="kit-command"
        initial={reduced ? false : { opacity: 0, y: -16, clipPath: 'inset(0 0 100% 0 round 16px)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0% 0 round 16px)' }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: reduced ? 0 : .28, ease: [.16, 1, .3, 1] }}
        onKeyDown={event => {
          if (event.key === 'Escape') onClose();
          if (event.key === 'ArrowDown') { event.preventDefault(); setActive(index => flat.length ? (index + 1) % flat.length : 0); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => flat.length ? (index - 1 + flat.length) % flat.length : 0); }
          if (event.key === 'Enter') { event.preventDefault(); if (flat[active]) select(flat[active]); else submitSearch(); }
        }}
      >
        <div className="kit-command-input-wrap">
          <Search aria-hidden />
          <input ref={inputRef} role="combobox" aria-expanded="true" aria-controls="kit-command-results" aria-autocomplete="list" aria-activedescendant={flat[active] ? `kit-command-option-${active}` : undefined} value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} placeholder="Search songs, albums, artists, or commands" aria-label="Search Nebula" />
          <kbd>Esc</kbd>
        </div>
        <div id="kit-command-results" className="kit-command-results" role="listbox" aria-label="Search suggestions">
          {filtered.map(group => <section key={group.label}>
            <p>{group.label}</p>
            {group.items.map(item => {
              const index = flat.indexOf(item);
              return <button id={`kit-command-option-${index}`} type="button" role="option" aria-selected={index === active} key={item.id} onMouseEnter={() => setActive(index)} onClick={() => select(item)}>
                <span className="kit-command-icon">{item.icon}</span>
                <span><strong>{item.label}</strong>{item.hint && <small>{item.hint}</small>}</span>
                <CornerDownLeft />
              </button>;
            })}
          </section>)}
          {!flat.length && <div className="kit-command-empty"><SearchX /><strong>No matches</strong><span>Press Enter to search the server for “{query}”.</span></div>}
        </div>
        <footer><span><kbd><ArrowUp /></kbd><kbd><ArrowDown /></kbd> Navigate</span><span><kbd><CornerDownLeft /></kbd> Select</span></footer>
      </motion.div>
    </motion.div>}
  </AnimatePresence>;
}

export function ArtworkTrackCard({ art, title, artist, active = false, onPlay, onOpen, action }: {
  art: string;
  title: string;
  artist: string;
  active?: boolean;
  onPlay: () => void;
  onOpen?: () => void;
  action?: React.ReactNode;
}) {
  return <article className="kit-artwork-card" data-active={active}>
    <img className="kit-artwork-glow" src={art} alt="" aria-hidden />
    <button type="button" className="kit-artwork-cover" onClick={onPlay} aria-label={`Play ${title} by ${artist}`}>
      <img src={art} alt="" />
      <span className="kit-vinyl" aria-hidden><i /></span>
      <span className="kit-cover-play">{active ? <Pause /> : <Play />}</span>
    </button>
    <div className="kit-artwork-copy">
      <button type="button" onClick={onOpen ?? onPlay}><strong>{title}</strong><span>{artist}</span></button>
      {action}
    </div>
  </article>;
}

export function SegmentedControl<T extends string>({ value, options, onChange, label, disabled = false }: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
}) {
  const reduced = useReducedMotion();
  const controlId = React.useId();
  return <div className="kit-segments" role="group" aria-label={label} style={{ '--segment-count': options.length } as React.CSSProperties}>
    {options.map(option => {
      const active = option.value === value;
      return <button type="button" disabled={disabled} key={option.value} data-active={active} onClick={() => onChange(option.value)}>
        {active && <motion.span aria-hidden className="kit-segment-indicator" layoutId={`segment-${controlId}`} transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 430, damping: 36, mass: .7 }} />}
        <span className="kit-segment-label">{option.label}</span>
      </button>;
    })}
  </div>;
}

export function LoadingState({ label = 'Loading your music' }: { label?: string }) {
  return <div className="kit-state"><span className="kit-loader" /><strong>{label}</strong></div>;
}

export function EmptyState({ icon, title, copy, action }: { icon: React.ReactNode; title: string; copy: string; action?: React.ReactNode }) {
  return <div className="kit-state">{icon}<strong>{title}</strong><small>{copy}</small>{action}</div>;
}
