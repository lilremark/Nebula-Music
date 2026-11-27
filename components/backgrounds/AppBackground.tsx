import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import type { BackgroundId } from '../../constants/appearance';
import { useDocumentVisible } from '../../hooks/useDocumentVisible';
import { CANVAS_SCENES, parseRgb, type CanvasSceneId, type ScenePalette } from './canvasScenes';
import './backgrounds.css';

/**
 * Animated content-pane background. Lazy-loaded by App.tsx and mounted only
 * while a background is selected and the full-screen player is closed.
 * Sits behind the top bar and scroller (z-index -1 inside the content shell's
 * isolated stacking context), never receives pointer events and is hidden
 * from assistive technology.
 */

const MAX_FPS = 30;
const MAX_DPR = 1.5;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia?.(reducedMotionQuery);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const getReducedMotion = () => window.matchMedia?.(reducedMotionQuery).matches ?? false;
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

/** Re-reads palette colours whenever the theme attributes on <html> change. */
const subscribeTheme = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-nebula-theme'] });
  return () => observer.disconnect();
};
const getThemeSnapshot = () => {
  const root = document.documentElement;
  return `${root.classList.contains('dark')}|${root.getAttribute('data-nebula-theme') ?? ''}|${root.style.getPropertyValue('--color-primary')}`;
};
const useThemeRevision = () => useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => '');

const CanvasBackground: React.FC<{ scene: CanvasSceneId; running: boolean; reducedMotion: boolean }> = ({ scene, running, reducedMotion }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(running);
  const resumeRef = useRef<(() => void) | null>(null);
  const themeRevision = useThemeRevision();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const parent = canvas.parentElement ?? canvas;

    // The canvas is styled `color: var(--next-accent)` and its wrapper `color: var(--next-text)`,
    // so computed colours give resolved rgb() values for every preset and mode.
    const palette: ScenePalette = {
      accent: parseRgb(getComputedStyle(canvas).color),
      ink: parseRgb(getComputedStyle(parent).color),
    };

    let frame = 0;
    let lastPaint = 0;
    let draw: ((time: number) => void) | null = null;
    let interval = 1000 / MAX_FPS;
    let builtWidth = 0;
    let builtHeight = 0;

    const build = () => {
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      if (width === builtWidth && height === builtHeight && draw) return;
      builtWidth = width;
      builtHeight = height;
      if (!width || !height) { draw = null; return; }
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const built = CANVAS_SCENES[scene](ctx, { width, height, dpr }, palette);
      interval = 1000 / Math.min(MAX_FPS, built.fps);
      draw = built.draw;
      // Always paint one frame immediately (and only that one when paused / reduced motion).
      draw(reducedMotion ? 4000 : performance.now());
    };

    const loop = (time: number) => {
      frame = 0;
      if (!runningRef.current) return; // paused: resumed by the effect below
      frame = requestAnimationFrame(loop);
      if (time - lastPaint < interval) return;
      lastPaint = time;
      draw?.(time);
    };
    const resume = () => {
      if (!frame && !reducedMotion && runningRef.current) frame = requestAnimationFrame(loop);
    };
    resumeRef.current = resume;

    build();
    const resizeObserver = new ResizeObserver(() => build());
    resizeObserver.observe(parent);
    resume();

    return () => {
      resumeRef.current = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [scene, reducedMotion, themeRevision]);

  // Pause/resume without rebuilding the scene (keeps particle positions etc.).
  useEffect(() => {
    runningRef.current = running;
    if (running) resumeRef.current?.();
  }, [running]);

  return <canvas ref={canvasRef} className="nebula-app-background-canvas" data-scene={scene} />;
};

const AppBackground: React.FC<{ variant: BackgroundId }> = ({ variant }) => {
  const visible = useDocumentVisible();
  const reducedMotion = usePrefersReducedMotion();
  // windowVisibility.ts flips document.hidden together with html[data-window-hidden];
  // check both so a hidden-to-tray window never animates.
  const running = visible && !document.documentElement.hasAttribute('data-window-hidden');

  if (variant === 'none') return null;
  const isCanvas = variant in CANVAS_SCENES;

  return (
    <div className="nebula-app-background" data-nebula-app-background={variant} aria-hidden="true">
      {variant === 'aurora' && (
        <div className="nebula-aurora">
          <span /><span /><span />
        </div>
      )}
      {variant === 'dot-grid' && <div className="nebula-pattern nebula-pattern-dots" />}
      {variant === 'grid' && <div className="nebula-pattern nebula-pattern-grid"><div /></div>}
      {isCanvas && <CanvasBackground scene={variant as CanvasSceneId} running={running} reducedMotion={reducedMotion} />}
    </div>
  );
};

export default AppBackground;
