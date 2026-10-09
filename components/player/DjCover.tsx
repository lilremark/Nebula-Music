import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useSpeechEnergy } from '../../hooks/useSpeechEnergy';
import fallback from '../../assets/dj-cover.svg';

const Orb = lazy(() => import('../vendor/shadercn/components/orbs/orb-21').then(module => ({ default: module.Orb21 })));
const palette = { light: '#e9d5ff', shadow: '#59328a' };
const states = { idle: palette, thinking: palette, speaking: palette };

export function DjCover({ playing = false, animateIdle = false, analyser = null, energy: remoteEnergy, className = '' }: {
  playing?: boolean; animateIdle?: boolean; analyser?: AnalyserNode | null; energy?: number; className?: string;
}) {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [painted, setPainted] = useState(false);
  const localEnergy = useSpeechEnergy(analyser, playing && visible && !reduced);
  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const refresh = () => setReduced(media.matches);
    media.addEventListener('change', refresh); refresh();
    return () => media.removeEventListener('change', refresh);
  }, []);
  useEffect(() => {
    const element = root.current; if (!element) return;
    let intersects = true;
    const refresh = () => setVisible(intersects && document.visibilityState === 'visible');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { intersects = entries.some(entry => entry.isIntersecting); refresh(); });
    observer?.observe(element); document.addEventListener('visibilitychange', refresh); refresh();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const animated = (playing || animateIdle) && visible && !reduced && !failed && !!navigator.gpu;
  useEffect(() => { if (!animated) setPainted(false); }, [animated]);
  return <div ref={root} className={'nebula-dj-cover ' + className} data-shader-ready={animated && painted} role="img" aria-label="AI DJ cover">
    <img src={fallback} alt="" draggable={false} />
    {animated && <Suspense fallback={null}><Orb state={playing ? 'speaking' : 'idle'} colors={palette} stateColors={states}
      params={{ speed: 1.4, churn: 0.16, lightSpin: 0.06, power: 1.15, ambient: 0.12, shadowLift: 0.55, exposure: 0.85 }} volumes={{ input: 0, output: remoteEnergy ?? localEnergy }}
      maxDpr={1.5} pauseOffscreen onFirstFrame={() => setPainted(true)} onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /></Suspense>}
  </div>;
}
