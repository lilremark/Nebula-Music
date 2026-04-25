
import React, { useEffect, useRef } from 'react';
import { useStore } from '../context/Store';

// --- 3D Helper Functions ---
interface Point3D { x: number, y: number, z: number }

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
    const scale = fov / (fov + point.z);
    const x = point.x * scale + width / 2;
    const y = point.y * scale + height / 2;
    return { x, y, scale };
}

const withAlpha = (color: string, alpha: number) => {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map(char => char + char).join('')
      : hex;

    if (normalized.length === 6) {
      const r = parseInt(normalized.slice(0, 2), 16);
      const g = parseInt(normalized.slice(2, 4), 16);
      const b = parseInt(normalized.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
  }

  if (color.startsWith('rgba(')) {
    return color.replace(/rgba\((.+),\s*[\d.]+\)/, `rgba($1, ${alpha})`);
  }

  return color;
};

export const Visualizer: React.FC<{ className?: string; primaryColor?: string; secondaryColor?: string }> = ({
  className,
  primaryColor = '#06b6d4',
  secondaryColor = '#8b5cf6',
}) => {
  const { analyser, visualizerMode } = useStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationIdRef = useRef<number>(0);

  // Persistent state for visualizers
  const stateRef = useRef({
      angle: 0,
      gridOffset: 0,
      particles: [] as {x: number, y: number, z: number, speed: number}[],
      rotationX: 0,
      rotationY: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      animationIdRef.current = requestAnimationFrame(renderFrame);
      
      // Handle Resize
      const displayWidth = canvas.clientWidth;
      const displayHeight = canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      
      if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
          canvas.width = displayWidth * dpr;
          canvas.height = displayHeight * dpr;
      }
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Reset transform & clear
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Gradient Setup
      const gradient = ctx.createLinearGradient(0, height, width, 0);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, secondaryColor);

      // Global Config
      ctx.lineWidth = 2 * dpr;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = gradient;
      ctx.fillStyle = gradient;

      // Fetch Data
      analyser.getByteFrequencyData(dataArray);
      analyser.getByteTimeDomainData(timeDataArray);
      
      // Bass detection for pulses
      const bass = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10 / 255; 
      stateRef.current.angle += 0.005 + (bass * 0.02);
      stateRef.current.gridOffset = (stateRef.current.gridOffset + 2 + bass * 5) % 100;

      // --- VISUALIZER MODES ---

      if (visualizerMode === 'BARS') {
          const bars = 64; 
          const step = Math.floor((bufferLength * 0.8) / bars) || 1; 
          const barWidth = width / bars;

          for(let i=0; i<bars; i++) {
             const value = dataArray[i * step] || 0;
             const percent = value / 255;
             const barHeight = Math.max(4 * dpr, percent * height * 0.8);
             
             // Top rounded rect
             const x = i * barWidth;
             const y = height - barHeight;
             const w = barWidth - (2 * dpr);
             
             ctx.fillStyle = gradient;
             ctx.beginPath();
             ctx.roundRect(x, y, w, barHeight, 4 * dpr);
             ctx.fill();

             // Reflection
             ctx.globalAlpha = 0.2;
             ctx.fillRect(x, height, w, barHeight * 0.3);
             ctx.globalAlpha = 1;
          }
      }
      else if (visualizerMode === 'WAVE') {
          ctx.beginPath();
          const sliceWidth = width * 1.0 / bufferLength;
          let x = 0;
          for (let i = 0; i < bufferLength; i++) {
              const v = timeDataArray[i] / 128.0;
              const y = v * height / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
          }
          ctx.lineTo(width, height / 2);
          ctx.stroke();
      }
      else if (visualizerMode === 'CIRCLE') {
          const cx = width / 2;
          const cy = height / 2;
          const radius = Math.min(width, height) / 3.5;
          const bars = 80;
          const step = Math.floor((bufferLength * 0.6) / bars);

          // Double mirrored circle
          for (let i = 0; i < bars; i++) {
              const val = dataArray[i * step] / 255;
              const h = val * (radius * 0.8);
              const angle = (Math.PI * 2 * i) / bars;
              
              const x1 = cx + Math.cos(angle) * radius;
              const y1 = cy + Math.sin(angle) * radius;
              const x2 = cx + Math.cos(angle) * (radius + h);
              const y2 = cy + Math.sin(angle) * (radius + h);
              
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              
              // Inner ring (mirrored)
              const x3 = cx + Math.cos(angle) * (radius - h * 0.3);
              const y3 = cy + Math.sin(angle) * (radius - h * 0.3);
              ctx.moveTo(x1, y1);
              ctx.lineTo(x3, y3);
              
              ctx.stroke();
          }
      }
      else if (visualizerMode === 'MIRROR') {
          const bars = 50;
          const step = Math.floor(bufferLength / 2 / bars);
          const barWidth = (width / 2) / bars;
          
          for(let i=0; i<bars; i++) {
             const value = dataArray[i * step];
             const percent = value / 255;
             const h = Math.max(2, percent * height * 0.6);
             
             const xRight = (width / 2) + (i * barWidth);
             const xLeft = (width / 2) - ((i + 1) * barWidth);
             const y = (height - h) / 2;
             
             // Add glow effect
             ctx.shadowBlur = 15;
             ctx.shadowColor = secondaryColor;

             ctx.fillRect(xRight, y, barWidth - 1, h);
             ctx.fillRect(xLeft, y, barWidth - 1, h);
             
             ctx.shadowBlur = 0;
          }
      }
      else if (visualizerMode === 'PARTICLES') {
          // 3D Starfield
          if (stateRef.current.particles.length === 0) {
              for(let i=0; i<150; i++) {
                  stateRef.current.particles.push({
                      x: (Math.random() - 0.5) * width,
                      y: (Math.random() - 0.5) * height,
                      z: Math.random() * width,
                      speed: Math.random() * 5 + 2
                  });
              }
          }

          const particles = stateRef.current.particles;
          const speedMultiplier = 1 + bass * 5;

          particles.forEach(p => {
              p.z -= p.speed * speedMultiplier;
              if (p.z <= 0) {
                  p.z = width;
                  p.x = (Math.random() - 0.5) * width;
                  p.y = (Math.random() - 0.5) * height;
              }

              const projection = project(p, width, height, width * 0.8);
              const size = (1 - p.z / width) * 4 * dpr + (bass * 2);
              const alpha = 1 - p.z / width;

              ctx.fillStyle = withAlpha(primaryColor, Math.max(0.18, alpha));
              ctx.beginPath();
              ctx.arc(projection.x, projection.y, size, 0, Math.PI * 2);
              ctx.fill();
          });
      }
      else if (visualizerMode === 'HEXAGON') {
          const cx = width / 2;
          const cy = height / 2;
          const rBase = (Math.min(width, height) / 4);
          const r = rBase * (0.8 + bass * 0.4);
          
          // Outer Hex
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
              const angle = (i * 2 * Math.PI) / 6 + stateRef.current.angle;
              const x = cx + r * Math.cos(angle);
              const y = cy + r * Math.sin(angle);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.lineWidth = (4 + bass * 20) * dpr;
          ctx.strokeStyle = gradient;
          ctx.stroke();
          
          // Inner Hexes (Trippy effect)
          for(let j=1; j<=3; j++) {
              ctx.beginPath();
              const rInner = r * (1 - j * 0.2);
              for (let i = 0; i < 6; i++) {
                  const angle = (i * 2 * Math.PI) / 6 - stateRef.current.angle * j;
                  const x = cx + rInner * Math.cos(angle);
                  const y = cy + rInner * Math.sin(angle);
                  if (i === 0) ctx.moveTo(x, y);
                  else ctx.lineTo(x, y);
              }
              ctx.closePath();
              ctx.lineWidth = 2 * dpr;
              ctx.stroke();
          }
      }
      else if (visualizerMode === 'CUBE') {
          // 3D Rotating Cube
          const size = Math.min(width, height) / 4 * (0.8 + bass * 0.5);
          
          const vertices = [
            {x: -1, y: -1, z: -1}, {x: 1, y: -1, z: -1}, {x: 1, y: 1, z: -1}, {x: -1, y: 1, z: -1},
            {x: -1, y: -1, z: 1}, {x: 1, y: -1, z: 1}, {x: 1, y: 1, z: 1}, {x: -1, y: 1, z: 1}
          ].map(v => ({ x: v.x * size, y: v.y * size, z: v.z * size }));

          const edges = [
            [0,1], [1,2], [2,3], [3,0], // front
            [4,5], [5,6], [6,7], [7,4], // back
            [0,4], [1,5], [2,6], [3,7]  // connecting
          ];

          stateRef.current.rotationX += 0.01;
          stateRef.current.rotationY += 0.015;

          const projectedVertices = vertices.map(v => {
              let r = rotateY(v, stateRef.current.rotationY);
              r = rotateX(r, stateRef.current.rotationX);
              r.z += 400; // Push back into scene
              return project(r, width, height, 400);
          });

          ctx.strokeStyle = withAlpha(secondaryColor, 0.9);
          ctx.lineWidth = 2 * dpr;

          edges.forEach(edge => {
              const v1 = projectedVertices[edge[0]];
              const v2 = projectedVertices[edge[1]];
              ctx.beginPath();
              ctx.moveTo(v1.x, v1.y);
              ctx.lineTo(v2.x, v2.y);
              ctx.stroke();
          });

          // Draw vertex points
          ctx.fillStyle = gradient;
          projectedVertices.forEach(v => {
              ctx.beginPath();
              ctx.arc(v.x, v.y, 4 * dpr * v.scale, 0, Math.PI * 2);
              ctx.fill();
          });
      }
      else if (visualizerMode === 'GRID') {
          // Retro Synthwave Grid
          const fov = 300;
          const gridSize = 100 * dpr;
          const cols = 20;
          const rows = 20;
          const horizonY = height * 0.4; // Horizon line height
          
          // Audio modulation on X axis (cols)
          const freqStep = Math.floor(bufferLength / cols);

          ctx.strokeStyle = withAlpha(secondaryColor, 0.9);
          ctx.lineWidth = 1 * dpr;
          
          // Draw Vertical Lines
          for (let i = -cols/2; i <= cols/2; i++) {
              const freqIndex = Math.abs(i) * freqStep;
              const heightMod = (dataArray[freqIndex] || 0) / 255 * 100 * dpr;
              
              ctx.beginPath();
              for (let j = 0; j < rows; j++) {
                  const z = j * gridSize - (stateRef.current.gridOffset * dpr) + 100; // Move towards camera
                  if (z <= 10) continue; // Clip
                  
                  const x = i * gridSize;
                  // y represents flat ground, displace y upwards with music
                  const y = 200 * dpr - (heightMod * (1 - j/rows)); 
                  
                  const p = project({x, y, z}, width, height, fov);
                  
                  // Limit drawing below horizon for pseudo-3D look
                  if (p.y < horizonY) continue;

                  if (j === 0) ctx.moveTo(p.x, p.y);
                  else ctx.lineTo(p.x, p.y);
              }
              ctx.stroke();
          }

          // Draw Horizontal Lines
          for (let j = 0; j < rows; j++) {
              const z = j * gridSize - (stateRef.current.gridOffset * dpr) + 100;
              if (z <= 10) continue;

              ctx.beginPath();
              let started = false;
              for (let i = -cols/2; i <= cols/2; i++) {
                  const x = i * gridSize;
                  const freqIndex = Math.abs(i) * freqStep;
                  const heightMod = (dataArray[freqIndex] || 0) / 255 * 100 * dpr;
                  const y = 200 * dpr - (heightMod * (1 - j/rows));

                  const p = project({x, y, z}, width, height, fov);
                  if (p.y < horizonY) continue;

                  if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                  else ctx.lineTo(p.x, p.y);
              }
              if(started) ctx.stroke();
          }

          // Horizon Glow
          const grad = ctx.createLinearGradient(0, horizonY, 0, height);
          grad.addColorStop(0, withAlpha(primaryColor, 0.5));
          grad.addColorStop(0.5, 'transparent');
          ctx.fillStyle = grad;
          ctx.fillRect(0, horizonY, width, height - horizonY);
      }
      else {
          // Spectrum fallback using the adaptive album palette
          const bars = 100;
          const barWidth = width / bars;
          for(let i=0; i<bars; i++) {
              const h = (dataArray[i] / 255) * height;
              const barGradient = ctx.createLinearGradient(0, height, 0, height - h);
              barGradient.addColorStop(0, primaryColor);
              barGradient.addColorStop(1, secondaryColor);
              ctx.fillStyle = barGradient;
              ctx.fillRect(i * barWidth, height - h, barWidth, h);
          }
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
