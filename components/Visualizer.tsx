
import React, { useEffect, useRef } from 'react';
import { useStore } from '../context/Store';
import { clamp, getBandForPosition, getFrequencyBin, getFrequencyBands } from './visualizerBands';

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

  if (typeof ctx.roundRect === 'function') {
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

const averageFrequencyRange = (data: Uint8Array, sampleRate: number, startHz: number, endHz: number) => {
  const start = getFrequencyBin(startHz, sampleRate, data.length);
  const end = Math.min(data.length, Math.max(start + 1, getFrequencyBin(endHz, sampleRate, data.length) + 1));
  let sum = 0;

  for (let i = start; i < end; i++) sum += data[i];
  return sum / (end - start) / 255;
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
  const { analyser, visualizerMode, isPlaying } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);
  const warnedFrameErrorsRef = useRef<Set<string>>(new Set());
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const stateRef = useRef({
    angle: 0,
    smoothedBandSets: {} as Record<number, number[]>,
    lastWidth: 0,
    lastHeight: 0,
    peak: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);
    const sampleRate = analyser.context.sampleRate;

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

      // Skip drawing while paused or hidden (backgroundThrottling is disabled,
      // so this loop keeps firing even when the window is minimized/trayed).
      if (!isPlayingRef.current || document.visibilityState !== 'visible') return;

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

        const getBands = (count: number) => {
          const bands = getFrequencyBands(dataArray, count, stateRef.current.smoothedBandSets[count] || [], sampleRate);
          stateRef.current.smoothedBandSets[count] = bands;
          return bands;
        };

        const bars72 = getBands(72);

        const maxFrequency = Math.min(20000, sampleRate * 0.48);
        const bass = Math.pow(averageFrequencyRange(dataArray, sampleRate, 32, 160), 0.7);
        const lowMid = Math.pow(averageFrequencyRange(dataArray, sampleRate, 160, 600), 0.7);
        const mid = Math.pow(averageFrequencyRange(dataArray, sampleRate, 600, 2400), 0.7);
        const treble = Math.pow(averageFrequencyRange(dataArray, sampleRate, 2400, 8000), 0.64);
        const air = Math.pow(averageFrequencyRange(dataArray, sampleRate, 8000, maxFrequency), 0.58);
        const highEnergy = clamp(treble * 0.72 + air * 0.48);
        const waveRms = clamp(getWaveRms(timeDataArray) * 2.4);
        const energy = clamp((bass * 0.32) + (lowMid * 0.2) + (mid * 0.22) + (treble * 0.16) + (air * 0.1), 0, 1);
        stateRef.current.peak = Math.max(energy, stateRef.current.peak * 0.94);
        const peak = stateRef.current.peak;

          stateRef.current.angle += 0.004 + bass * 0.022 + highEnergy * 0.018;

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
          const gain = 0.7 + energy * 1.55 + highEnergy * 0.35;

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
            const y = centerY - normalized * height * 0.22 * (1 + mid + highEnergy * 0.35);
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
          const bands = getBands(bars);

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
          const bands = getBands(bars);
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
          const bands = getBands(132);
          drawSpectrum(width, height, bands, gradient, dpr);

          ctx.globalAlpha = 0.2 + peak * 0.18;
          ctx.fillStyle = withAlpha(primaryColor, 0.5);
          ctx.fillRect(0, height - Math.max(2 * dpr, height * bass * 0.08), width, Math.max(2 * dpr, height * bass * 0.08));
          ctx.globalAlpha = 1;
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
