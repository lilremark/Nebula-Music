/**
 * Canvas scenes for the animated content-pane backgrounds. Each factory gets a
 * 2D context already scaled to CSS pixels and returns a `draw(timeMs)` that
 * paints one complete frame. Factories are re-created on resize and palette
 * changes, so they may precompute freely.
 *
 * Lean local takes on shadcn-ecosystem backgrounds (see components/vendor/README.md):
 * Magic UI Flickering Grid / Particles, and ASCII/matrix-style glyph fields.
 */

export interface ScenePalette {
  /** Accent as [r, g, b]. */
  accent: [number, number, number];
  /** Body text colour as [r, g, b] (used for neutral ink). */
  ink: [number, number, number];
}

export interface SceneSize { width: number; height: number; dpr: number }

export interface Scene {
  draw: (timeMs: number) => void;
  /** Frames per second the scene needs (capped at 30 by the runner). */
  fps: number;
}

export type SceneFactory = (ctx: CanvasRenderingContext2D, size: SceneSize, palette: ScenePalette) => Scene;

const rgba = ([r, g, b]: [number, number, number], alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;

/** Small deterministic hash → [0, 1). */
const hash = (x: number, y: number, seed = 0) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

const MONO_FONT = "'JetBrains Mono', ui-monospace, 'Cascadia Mono', Consolas, monospace";

/**
 * Pre-renders glyphs once so frames use drawImage (much cheaper than fillText
 * for thousands of cells).
 */
const createGlyphAtlas = (glyphs: string, cellW: number, cellH: number, fontPx: number, color: string, dpr: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(cellW * glyphs.length * dpr);
  canvas.height = Math.ceil(cellH * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.font = `500 ${fontPx}px ${MONO_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    for (let i = 0; i < glyphs.length; i++) ctx.fillText(glyphs[i], i * cellW + cellW / 2, cellH / 2 + 0.5);
  }
  return {
    draw: (target: CanvasRenderingContext2D, index: number, x: number, y: number) => {
      target.drawImage(canvas, index * cellW * dpr, 0, cellW * dpr, cellH * dpr, x, y, cellW, cellH);
    },
  };
};

/** Magic UI-style flickering grid: small squares whose opacity flickers at random. */
export const flickeringGridScene: SceneFactory = (ctx, { width, height }, palette) => {
  const square = 3;
  const gap = 9;
  const cell = square + gap;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const levels = 6;
  const maxOpacity = 0.55;
  const count = cols * rows;
  const values = new Uint8Array(count);
  for (let i = 0; i < count; i++) values[i] = Math.floor(Math.random() * levels);
  const styles = Array.from({ length: levels }, (_, level) => rgba(palette.accent, (level / (levels - 1)) * maxOpacity));
  let last = 0;
  return {
    fps: 20,
    draw: (time) => {
      const dt = last ? Math.min(0.25, (time - last) / 1000) : 0;
      last = time;
      // ~30% of squares change level per second.
      const changes = Math.round(count * 0.3 * dt);
      for (let i = 0; i < changes; i++) values[(Math.random() * count) | 0] = (Math.random() * levels) | 0;
      ctx.clearRect(0, 0, width, height);
      for (let level = 1; level < levels; level++) {
        ctx.fillStyle = styles[level];
        ctx.beginPath();
        for (let i = 0; i < count; i++) {
          if (values[i] !== level) continue;
          ctx.rect((i % cols) * cell, ((i / cols) | 0) * cell, square, square);
        }
        ctx.fill();
      }
    },
  };
};

/** Sparse, slow-drifting specks that gently twinkle (after Magic UI Particles, minus the mouse). */
export const particlesScene: SceneFactory = (ctx, { width, height }, palette) => {
  const total = Math.min(90, Math.round((width * height) / 16000));
  const particles = Array.from({ length: total }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: 0.6 + Math.random() * 1.3,
    vx: (Math.random() - 0.5) * 6,
    vy: -2 - Math.random() * 6,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.35 + Math.random() * 0.55,
  }));
  let last = 0;
  return {
    fps: 30,
    draw: (time) => {
      const dt = last ? Math.min(0.25, (time - last) / 1000) : 0;
      last = time;
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -4) { p.y = height + 4; p.x = Math.random() * width; }
        if (p.x < -4) p.x = width + 4;
        else if (p.x > width + 4) p.x = -4;
        const twinkle = 0.65 + 0.35 * Math.sin(time / 1400 + p.phase);
        ctx.fillStyle = rgba(palette.accent, p.alpha * twinkle);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  };
};

export const ASCII_RAMP = ' .:-=+*#%@';

/**
 * Slow-shifting density-ramp noise: each cell maps a few layered sine waves
 * onto ` .:-=+*#%@`. Only cells whose glyph changed are repainted.
 */
export const asciiFieldScene: SceneFactory = (ctx, { width, height, dpr }, palette) => {
  const cellW = 10;
  const cellH = 16;
  const cols = Math.ceil(width / cellW);
  const rows = Math.ceil(height / cellH);
  const atlas = createGlyphAtlas(ASCII_RAMP, cellW, cellH, 12, rgba(palette.accent, 1), dpr);
  const current = new Int8Array(cols * rows).fill(-1);
  const seedX = Math.random() * 1000;
  const seedY = Math.random() * 1000;
  return {
    fps: 12,
    draw: (time) => {
      const t = time / 1000;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col + seedX;
          const y = row * 1.6 + seedY;
          const v = Math.sin(x * 0.09 + t * 0.35) + Math.sin(y * 0.07 - t * 0.27) + Math.sin((x + y) * 0.045 + t * 0.18) + Math.sin(Math.hypot(x * 0.6, y) * 0.05 - t * 0.22);
          // v ∈ [-4, 4] → index, biased towards blank so the field stays airy.
          const index = Math.max(0, Math.min(ASCII_RAMP.length - 1, Math.floor(((v + 4) / 8) ** 1.6 * ASCII_RAMP.length)));
          const cellIndex = row * cols + col;
          if (current[cellIndex] === index) continue;
          current[cellIndex] = index;
          const px = col * cellW;
          const py = row * cellH;
          ctx.clearRect(px, py, cellW, cellH);
          if (index > 0) atlas.draw(ctx, index, px, py);
        }
      }
    },
  };
};

const RAIN_GLYPHS = '01<>/\\|=+*#{}[]:;';

/** Matrix-style falling columns, slow and sparse; trails fade with distance from the head. */
export const asciiRainScene: SceneFactory = (ctx, { width, height, dpr }, palette) => {
  const cellW = 14;
  const cellH = 18;
  const cols = Math.ceil(width / cellW);
  const rows = Math.ceil(height / cellH);
  const atlas = createGlyphAtlas(RAIN_GLYPHS, cellW, cellH, 13, rgba(palette.accent, 1), dpr);
  const drops = Array.from({ length: cols }, (_, col) => ({
    active: hash(col, 7) < 0.55,
    head: Math.random() * (rows + 20) - 20,
    speed: 2.5 + Math.random() * 4.5, // rows per second
    trail: 8 + Math.floor(Math.random() * 14),
  }));
  let last = 0;
  return {
    fps: 24,
    draw: (time) => {
      const dt = last ? Math.min(0.25, (time - last) / 1000) : 0;
      last = time;
      const glyphShift = Math.floor(time / 900);
      ctx.clearRect(0, 0, width, height);
      for (let col = 0; col < cols; col++) {
        const drop = drops[col];
        if (!drop.active) continue;
        drop.head += drop.speed * dt;
        if (drop.head - drop.trail > rows) {
          drop.head = -Math.random() * 12;
          drop.speed = 2.5 + Math.random() * 4.5;
          drop.trail = 8 + Math.floor(Math.random() * 14);
        }
        const headRow = Math.floor(drop.head);
        for (let i = 0; i < drop.trail; i++) {
          const row = headRow - i;
          if (row < 0 || row >= rows) continue;
          ctx.globalAlpha = i === 0 ? 1 : 0.75 * (1 - i / drop.trail);
          const glyph = Math.floor(hash(col, row, glyphShift + (i === 0 ? headRow : 0)) * RAIN_GLYPHS.length);
          atlas.draw(ctx, glyph, col * cellW, row * cellH);
        }
      }
      ctx.globalAlpha = 1;
    },
  };
};

export const CANVAS_SCENES = {
  'flickering-grid': flickeringGridScene,
  particles: particlesScene,
  'ascii-field': asciiFieldScene,
  'ascii-rain': asciiRainScene,
} as const;

export type CanvasSceneId = keyof typeof CANVAS_SCENES;

/** Parses `rgb(r, g, b)` / `rgba(r, g, b, a)` / `rgb(r g b)` as returned by getComputedStyle. */
export const parseRgb = (value: string, fallback: [number, number, number] = [128, 128, 128]): [number, number, number] => {
  const match = value.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : fallback;
};
