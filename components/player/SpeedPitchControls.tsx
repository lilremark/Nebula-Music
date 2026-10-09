import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Gauge, Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../../context/Store';

export const SpeedPitchControls: React.FC<{ showLabel?: boolean }> = ({ showLabel = false }) => {
  const { playbackRate, setPlaybackRate, pitch, setPitch, pitchCorrection, setPitchCorrection } = useStore();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!trigger || !panel) return;
      const above = trigger.top - panel.height - 10;
      setPosition({ left: Math.max(12, Math.min(window.innerWidth - panel.width - 12, trigger.right - panel.width)),
        top: Math.max(12, Math.min(window.innerHeight - panel.height - 12, above >= 12 ? above : trigger.bottom + 10)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); triggerRef.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape, true); };
  }, [open]);
  const adjust = (value: number, delta: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round((value + delta) * 10) / 10));
  const control = (name: string, value: number, min: number, max: number, set: (value: number) => void, unit: string) => <div className="nebula-speed-pitch-control">
    <label>{name}<output>{value > 0 && name === 'Pitch' ? '+' : ''}{value.toFixed(1)}{unit}</output></label>
    <div className="nebula-speed-pitch-stepper">
      <button type="button" aria-label={`Decrease ${name.toLowerCase()}`} disabled={value <= min} onClick={() => set(adjust(value, -0.1, min, max))}><Minus size={16} /></button>
      <input aria-label={`Playback ${name.toLowerCase()}`} type="range" min={min} max={max} step="0.1" value={value} onChange={event => set(Number(event.target.value))} />
      <button type="button" aria-label={`Increase ${name.toLowerCase()}`} disabled={value >= max} onClick={() => set(adjust(value, 0.1, min, max))}><Plus size={16} /></button>
    </div>
  </div>;
  return <>
    <button ref={triggerRef} type="button" className={`nebula-transport-icon nebula-speed-pitch-trigger ${showLabel ? 'has-label' : ''}`} aria-label="Speed and pitch controls" aria-expanded={open} aria-haspopup="dialog" title="Speed and pitch" onClick={() => setOpen(value => !value)}><Gauge size={18} />{showLabel && <span>Speed & Pitch</span>}</button>
    {open && createPortal(<div ref={panelRef} data-nebula-speed-pitch className="nebula-speed-pitch-panel" role="dialog" aria-label="Speed and pitch" style={position}>
      <div className="nebula-speed-pitch-heading"><strong>Speed & Pitch</strong><button type="button" aria-label="Close playback settings" onClick={() => { setOpen(false); triggerRef.current?.focus(); }}><X size={16} /></button></div>
      {control('Speed', playbackRate, 0.5, 2, setPlaybackRate, '×')}
      {control('Pitch', pitch, -12, 12, setPitch, ' st')}
      <button type="button" aria-pressed={pitchCorrection} onClick={() => setPitchCorrection(!pitchCorrection)}><SlidersHorizontal size={15} />Independent pitch</button>
      <button type="button" onClick={() => { setPlaybackRate(1); setPitch(0); }}>Reset speed and pitch</button>
    </div>, document.querySelector('.nebula-next') || document.body)}
  </>;
};
