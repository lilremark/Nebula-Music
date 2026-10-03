import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { useSpeechEnergy } from '../../hooks/useSpeechEnergy';
import fallback from '../../assets/dj-cover.svg';

const Orb = lazy(() => import('../vendor/shadercn/components/orbs/orb-21').then(module => ({ default: module.Orb21 })));
const palette = { light: '#e9d5ff', shadow: '#59328a' };
const states = { idle: palette, thinking: palette, speaking: palette };

export function DjCover({ playing = false, analyser = null, energy: remoteEnergy, className = '' }: {
  playing?: boolean; analyser?: AnalyserNode | null; energy?: number; className?: string;
}) {
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const localEnergy = useSpeechEnergy(analyser, playing && visible && !reduced);
  useEffect(() => {
    const element = root.current; if (!element) return;
    let intersects = true;
    const refresh = () => setVisible(intersects && document.visibilityState === 'visible');
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { intersects = entries.some(entry => entry.isIntersecting); refresh(); });
    observer?.observe(element); document.addEventListener('visibilitychange', refresh); refresh();
    return () => { observer?.disconnect(); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  const animated = playing && visible && !reduced && !failed && !!navigator.gpu;
  return <div ref={root} className={'nebula-dj-cover ' + className} role="img" aria-label="AI DJ cover">
    <img src={fallback} alt="" draggable={false} />
    {animated && <Suspense fallback={null}><Orb state="speaking" colors={palette} stateColors={states}
      params={{ speed: 1.4, churn: 0.16, lightSpin: 0.06, power: 1.15, ambient: 0.12, shadowLift: 0.55, exposure: 0.85 }} volumes={{ input: 0, output: remoteEnergy ?? localEnergy }}
      maxDpr={1.5} pauseOffscreen onError={() => setFailed(true)} style={{ width: '100%', height: '100%' }} /></Suspense>}
  </div>;
}
