
import React, { useEffect, useRef } from 'react';
import { useStore } from '../context/Store';

interface Point3D { x: number, y: number, z: number }

interface Particle {
  x: number;
  y: number;
  z: number;
  speed: number;
  size: number;
}

function rotateX(point: Point3D, angle: number): Point3D {
  const y = point.y * Math.cos(angle) - point.z * Math.sin(angle);
  const z = point.y * Math.sin(angle) + point.z * Math.cos(angle);
  return { ...point, y, z };
}

function rotateY(point: Point3D, angle: number): Point3D {
  const x = point.x * Math.cos(angle) + point.z * Math.sin(angle);
  const z = -point.x * Math.sin(angle) + point.z * Math.cos(angle);
  return { ...point, x, z };
}

function project(point: Point3D, width: number, height: number, fov: number = 300) {
  const depth = Math.max(1, fov + point.z);
  const scale = fov / depth;
  const x = point.x * scale + width / 2;
  const y = point.y * scale + height / 2;
  return { x, y, scale };
}

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

const withAlpha = (color: string, alpha: number) => {
  const safeAlpha = clamp(alpha);

  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map(char => char + char).join('')
      : hex;

    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
    }
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${safeAlpha})`);
  }

  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\((.+),\s*[\d.]+\)/, `rgba($1, ${safeAlpha})`);
  }

  return color;
};

const createSafeGradient = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  primaryColor: string,
  secondaryColor: string,
): CanvasGradient | string => {
  const gradient = ctx.createLinearGradient(0, height, width, 0);

  try {
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, secondaryColor);
    return gradient;
  } catch {
    return '#06b6d4';
  }
};

const fillRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) => {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const safeRadius = Math.max(0, Math.min(radius, safeWidth / 2, safeHeight / 2));

  if ('roundRect' in ctx) {
    ctx.beginPath();
    ctx.roundRect(x, y, safeWidth, safeHeight, safeRadius);
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + safeWidth - safeRadius, y);
  ctx.quadraticCurveTo(x + safeWidth, y, x + safeWidth, y + safeRadius);
  ctx.lineTo(x + safeWidth, y + safeHeight - safeRadius);
  ctx.quadraticCurveTo(x + safeWidth, y + safeHeight, x + safeWidth - safeRadius, y + safeHeight);
  ctx.lineTo(x + safeRadius, y + safeHeight);
  ctx.quadraticCurveTo(x, y + safeHeight, x, y + safeHeight - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
  ctx.fill();
};

const averageRange = (data: Uint8Array, startRatio: number, endRatio: number) => {
  const start = Math.max(0, Math.floor(data.length * startRatio));
  const end = Math.min(data.length, Math.max(start + 1, Math.floor(data.length * endRatio)));
  let sum = 0;

  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start) / 255;
};

const getLogBands = (data: Uint8Array, count: number, previous: number[]) => {
  const bands = new Array(count);
  const usableBins = Math.max(1, Math.floor(data.length * 0.88));

  for (let i = 0; i < count; i++) {
    const startRatio = Math.pow(i / count, 2.15);
    const endRatio = Math.pow((i + 1) / count, 2.15);
    const start = Math.min(usableBins - 1, Math.floor(startRatio * usableBins));
    const end = Math.min(usableBins, Math.max(start + 1, Math.floor(endRatio * usableBins)));
    let sum = 0;

    for (let bin = start; bin < end; bin++) sum += data[bin];

    const raw = sum / (end - start) / 255;
    const boosted = Math.pow(raw, 0.68);
    const oldValue = previous[i] ?? 0;
    const smoothing = boosted > oldValue ? 0.42 : 0.18;
    bands[i] = oldValue + (boosted - oldValue) * smoothing;
  }

  return bands;
};

const getWaveRms = (data: Uint8Array) => {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const centered = (data[i] - 128) / 128;
    sum += centered * centered;
  }
  return Math.sqrt(sum / data.length);
};

export const Visualizer: React.FC<{ className?: string; primaryColor?: string; secondaryColor?: string }> = ({
  className,
  primaryColor = '#06b6d4',
  secondaryColor = '#8b5cf6',
}) => {
  const { analyser, visualizerMode } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);
  const warnedFrameErrorsRef = useRef<Set<string>>(new Set());

  const stateRef = useRef({
    angle: 0,
    gridOffset: 0,
    particles: [] as Particle[],
    rotationX: 0,
    rotationY: 0,
    smoothedBands: [] as number[],
    lastWidth: 0,
    lastHeight: 0,
    peak: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    analyser.fftSize = Math.max(analyser.fftSize, 2048);
    analyser.smoothingTimeConstant = 0.74;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const warnFrameError = (error: unknown) => {
      const key = `${visualizerMode}:${error instanceof Error ? error.message : String(error)}`;
      if (warnedFrameErrorsRef.current.has(key)) return;
      warnedFrameErrorsRef.current.add(key);
      console.warn(`Visualizer ${visualizerMode} frame failed; using fallback renderer.`, error);
    };

    const drawSpectrum = (width: number, height: number, bands: number[], gradient: CanvasGradient | string, dpr: number) => {
      if (width <= 0 || height <= 0) return;

      const barWidth = width / bands.length;
      for(let i = 0; i < bands.length; i++) {
        const value = bands[i] || 0;
        const h = Math.max(2 * dpr, value * height * 0.94);
        const x = i * barWidth;
        const y = height - h;

        ctx.fillStyle = i % 2 === 0 ? gradient : withAlpha(secondaryColor, 0.86);
        fillRoundedRect(ctx, x, y, barWidth * 0.82, h, 3 * dpr);
      }
    };

    const renderFrame = () => {
      animationIdRef.current = requestAnimationFrame(renderFrame);

      try {
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        const dpr = window.devicePixelRatio || 1;
        if (displayWidth <= 0 || displayHeight <= 0) return;

        const targetWidth = Math.floor(displayWidth * dpr);
        const targetHeight = Math.floor(displayHeight * dpr);
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }

        const width = canvas.width;
        const height = canvas.height;
        const resized = stateRef.current.lastWidth !== width || stateRef.current.lastHeight !== height;
        if (resized) {
          stateRef.current.particles = [];
          stateRef.current.lastWidth = width;
          stateRef.current.lastHeight = height;
        }

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const gradient = createSafeGradient(ctx, width, height, primaryColor, secondaryColor);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = gradient;
        ctx.fillStyle = gradient;

        analyser.getByteFrequencyData(dataArray);
        analyser.getByteTimeDomainData(timeDataArray);

        const bars72 = getLogBands(dataArray, 72, stateRef.current.smoothedBands);
        stateRef.current.smoothedBands = bars72;

        const bass = Math.pow(averageRange(dataArray, 0.0, 0.08), 0.72);
        const mid = Math.pow(averageRange(dataArray, 0.08, 0.36), 0.72);
        const treble = Math.pow(averageRange(dataArray, 0.36, 0.86), 0.72);
        const waveRms = clamp(getWaveRms(timeDataArray) * 2.4);
        const energy = clamp((bass * 0.48) + (mid * 0.34) + (treble * 0.18), 0, 1);
        stateRef.current.peak = Math.max(energy, stateRef.current.peak * 0.94);
        const peak = stateRef.current.peak;

        stateRef.current.angle += 0.004 + bass * 0.026 + treble * 0.012;
        stateRef.current.gridOffset = (stateRef.current.gridOffset + 1.4 + energy * 8) % 100;

        if (visualizerMode === 'BARS') {
          const barWidth = width / bars72.length;

          for(let i = 0; i < bars72.length; i++) {
            const value = bars72[i] || 0;
            const barHeight = Math.max(3 * dpr, value * height * 0.86);
            const x = i * barWidth;
            const y = height - barHeight;
            const w = Math.max(1, barWidth * 0.72);

            ctx.fillStyle = gradient;
            fillRoundedRect(ctx, x, y, w, barHeight, 4 * dpr);

            ctx.globalAlpha = 0.16 + value * 0.16;
            ctx.fillRect(x, height - 1, w, barHeight * 0.28);
            ctx.globalAlpha = 1;
          }
        }
        else if (visualizerMode === 'WAVE') {
          const centerY = height / 2;
          const gain = 0.68 + energy * 1.8;

          ctx.lineWidth = (2 + energy * 5) * dpr;
          ctx.beginPath();
          for (let i = 0; i < timeDataArray.length; i++) {
            const x = (i / (timeDataArray.length - 1)) * width;
            const normalized = (timeDataArray[i] - 128) / 128;
            const y = centerY + normalized * height * 0.34 * gain;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          ctx.globalAlpha = 0.2 + waveRms * 0.3;
          ctx.lineWidth = 1 * dpr;
          ctx.beginPath();
          for (let i = 0; i < timeDataArray.length; i += 3) {
            const x = (i / (timeDataArray.length - 1)) * width;
            const normalized = (timeDataArray[i] - 128) / 128;
            const y = centerY - normalized * height * 0.22 * (1 + mid);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.strokeStyle = withAlpha(secondaryColor, 0.9);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        else if (visualizerMode === 'CIRCLE') {
          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.min(width, height) * (0.2 + bass * 0.04);
          const bars = 96;
          const bands = getLogBands(dataArray, bars, bars72);

          ctx.lineWidth = (1.5 + peak * 3.5) * dpr;
          for (let i = 0; i < bars; i++) {
            const val = bands[i] || 0;
            const h = (0.08 + val) * radius * 0.95;
            const angle = (Math.PI * 2 * i) / bars + stateRef.current.angle * 0.16;
            const inner = radius - h * (0.18 + bass * 0.32);
            const outer = radius + h;

            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
            ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
            ctx.stroke();
          }

          ctx.globalAlpha = 0.24 + bass * 0.34;
          ctx.lineWidth = (2 + bass * 8) * dpr;
          ctx.beginPath();
          ctx.arc(cx, cy, radius * (0.72 + bass * 0.18), 0, Math.PI * 2);
          ctx.strokeStyle = withAlpha(secondaryColor, 0.9);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        else if (visualizerMode === 'MIRROR') {
          const bars = 56;
          const bands = getLogBands(dataArray, bars, bars72);
          const barWidth = (width / 2) / bars;
          const centerY = height / 2;

          for(let i = 0; i < bars; i++) {
            const value = bands[i] || 0;
            const h = Math.max(3 * dpr, value * height * 0.74);
            const xRight = (width / 2) + (i * barWidth);
            const xLeft = (width / 2) - ((i + 1) * barWidth);
            const y = centerY - h / 2;

            ctx.fillStyle = i % 3 === 0 ? withAlpha(secondaryColor, 0.86) : gradient;
            ctx.shadowBlur = (8 + value * 24) * dpr;
            ctx.shadowColor = i % 3 === 0 ? secondaryColor : primaryColor;
            fillRoundedRect(ctx, xRight, y, barWidth * 0.72, h, 3 * dpr);
            fillRoundedRect(ctx, xLeft, y, barWidth * 0.72, h, 3 * dpr);
          }
          ctx.shadowBlur = 0;
        }
        else if (visualizerMode === 'SPECTRUM') {
          const bands = getLogBands(dataArray, 120, bars72);
          drawSpectrum(width, height, bands, gradient, dpr);

          ctx.globalAlpha = 0.2 + peak * 0.18;
          ctx.fillStyle = withAlpha(primaryColor, 0.5);
          ctx.fillRect(0, height - Math.max(2 * dpr, height * bass * 0.08), width, Math.max(2 * dpr, height * bass * 0.08));
          ctx.globalAlpha = 1;
        }
        else if (visualizerMode === 'PARTICLES') {
          if (stateRef.current.particles.length === 0) {
            for(let i = 0; i < 170; i++) {
              stateRef.current.particles.push({
                x: (Math.random() - 0.5) * width,
                y: (Math.random() - 0.5) * height,
                z: Math.random() * width,
                speed: Math.random() * 4 + 1.6,
                size: Math.random() * 2 + 0.8,
              });
            }
          }

          const speedMultiplier = 0.85 + energy * 7;
          stateRef.current.particles.forEach((p, index) => {
            p.z -= p.speed * speedMultiplier;
            if (p.z <= 1) {
              p.z = width;
              p.x = (Math.random() - 0.5) * width;
              p.y = (Math.random() - 0.5) * height;
            }

            const projection = project(p, width, height, width * 0.82);
            const band = bars72[index % bars72.length] || 0;
            const size = (p.size + band * 5 + bass * 3) * dpr * clamp(1 - p.z / width, 0.25, 1.8);
            const alpha = clamp(0.18 + band * 0.64 + (1 - p.z / width) * 0.4);

            ctx.fillStyle = withAlpha(index % 2 === 0 ? primaryColor : secondaryColor, alpha);
            ctx.beginPath();
            ctx.arc(projection.x, projection.y, Math.max(0.8 * dpr, size), 0, Math.PI * 2);
            ctx.fill();
          });
        }
        else if (visualizerMode === 'HEXAGON') {
          const cx = width / 2;
          const cy = height / 2;
          const base = Math.min(width, height) * 0.2;
          const rings = 4;

          for(let ring = 0; ring < rings; ring++) {
            const ringEnergy = ring === 0 ? bass : ring === 1 ? mid : ring === 2 ? treble : energy;
            const radius = base * (1 + ring * 0.22 + ringEnergy * 0.42);
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i * 2 * Math.PI) / 6 + stateRef.current.angle * (ring % 2 === 0 ? 1 : -0.7);
              const band = bars72[(ring * 12 + i * 8) % bars72.length] || 0;
              const x = cx + (radius + band * base * 0.34) * Math.cos(angle);
              const y = cy + (radius + band * base * 0.34) * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.lineWidth = (1.5 + ringEnergy * 12) * dpr;
            ctx.strokeStyle = ring % 2 === 0 ? gradient : withAlpha(secondaryColor, 0.82);
            ctx.stroke();
          }
        }
        else if (visualizerMode === 'CUBE') {
          const size = Math.min(width, height) * (0.18 + energy * 0.08);
          const vertices = [
            {x: -1, y: -1, z: -1}, {x: 1, y: -1, z: -1}, {x: 1, y: 1, z: -1}, {x: -1, y: 1, z: -1},
            {x: -1, y: -1, z: 1}, {x: 1, y: -1, z: 1}, {x: 1, y: 1, z: 1}, {x: -1, y: 1, z: 1},
          ].map(v => ({ x: v.x * size, y: v.y * size, z: v.z * size }));

          const edges = [
            [0,1], [1,2], [2,3], [3,0],
            [4,5], [5,6], [6,7], [7,4],
            [0,4], [1,5], [2,6], [3,7],
          ];

          stateRef.current.rotationX += 0.006 + mid * 0.018;
          stateRef.current.rotationY += 0.008 + treble * 0.022;

          const projectedVertices = vertices.map(v => {
            let rotated = rotateY(v, stateRef.current.rotationY);
            rotated = rotateX(rotated, stateRef.current.rotationX);
            rotated.z += 380;
            return project(rotated, width, height, 390);
          });

          ctx.strokeStyle = withAlpha(secondaryColor, 0.72 + peak * 0.24);
          ctx.lineWidth = (1.5 + energy * 6) * dpr;
          edges.forEach(edge => {
            const v1 = projectedVertices[edge[0]];
            const v2 = projectedVertices[edge[1]];
            ctx.beginPath();
            ctx.moveTo(v1.x, v1.y);
            ctx.lineTo(v2.x, v2.y);
            ctx.stroke();
          });

          projectedVertices.forEach((v, index) => {
            const band = bars72[(index * 8) % bars72.length] || 0;
            ctx.fillStyle = index % 2 === 0 ? gradient : withAlpha(primaryColor, 0.9);
            ctx.beginPath();
            ctx.arc(v.x, v.y, (3 + band * 10) * dpr * v.scale, 0, Math.PI * 2);
            ctx.fill();
          });
        }
        else if (visualizerMode === 'GRID') {
          const fov = 310;
          const gridSize = 92 * dpr;
          const cols = 22;
          const rows = 22;
          const horizonY = height * (0.34 + treble * 0.05);

          ctx.strokeStyle = withAlpha(secondaryColor, 0.72 + energy * 0.2);
          ctx.lineWidth = (0.8 + energy * 1.8) * dpr;

          for (let i = -cols / 2; i <= cols / 2; i++) {
            const band = bars72[Math.min(bars72.length - 1, Math.floor((Math.abs(i) / (cols / 2)) * (bars72.length - 1)))] || 0;
            ctx.beginPath();
            let started = false;
            for (let j = 0; j < rows; j++) {
              const z = j * gridSize - (stateRef.current.gridOffset * dpr) + 110;
              if (z <= 10) continue;

              const x = i * gridSize;
              const y = 215 * dpr - band * 220 * dpr * (1 - j / rows) - bass * 35 * dpr;
              const p = project({x, y, z}, width, height, fov);
              if (p.y < horizonY) continue;

              if (!started) { ctx.moveTo(p.x, p.y); started = true; }
              else ctx.lineTo(p.x, p.y);
            }
            if (started) ctx.stroke();
          }

          for (let j = 0; j < rows; j++) {
            const z = j * gridSize - (stateRef.current.gridOffset * dpr) + 110;
            if (z <= 10) continue;

            ctx.beginPath();
            let started = false;
            for (let i = -cols / 2; i <= cols / 2; i++) {
              const index = Math.min(bars72.length - 1, Math.floor((Math.abs(i) / (cols / 2)) * (bars72.length - 1)));
              const band = bars72[index] || 0;
              const x = i * gridSize;
              const y = 215 * dpr - band * 220 * dpr * (1 - j / rows) - bass * 35 * dpr;
              const p = project({x, y, z}, width, height, fov);
              if (p.y < horizonY) continue;

              if (!started) { ctx.moveTo(p.x, p.y); started = true; }
              else ctx.lineTo(p.x, p.y);
            }
            if(started) ctx.stroke();
          }

          const glow = ctx.createLinearGradient(0, horizonY, 0, height);
          try {
            glow.addColorStop(0, withAlpha(primaryColor, 0.26 + bass * 0.28));
            glow.addColorStop(0.55, 'transparent');
            ctx.fillStyle = glow;
            ctx.fillRect(0, horizonY, width, height - horizonY);
          } catch {
            // Ignore color parsing failures; the grid itself has already rendered.
          }
        }
        else {
          drawSpectrum(width, height, bars72, gradient, dpr);
        }
      } catch (error) {
        warnFrameError(error);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    renderFrame();

    return () => {
      cancelAnimationFrame(animationIdRef.current);
    };
  }, [analyser, visualizerMode, primaryColor, secondaryColor]);

  return (
    <div className={`w-full h-full ${className}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};
