import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useDocumentVisible } from '../hooks/useDocumentVisible';
import { parseRgb } from './backgrounds/canvasScenes';
import {
  QUANTUM_NEBULA_CONFIG,
  createNebulaState,
  projectPointerToWorld,
  recolorNebulaState,
  resolveNebulaPalette,
  stepNebulaSimulation,
  writeCameraMatrices,
  type NebulaInteraction,
  type NebulaPalette,
  type NebulaSimulationState,
} from './quantumNebulaEngine';

const MAX_DPR = 1.75;
const BLOOM_MIPS = 5;
const BLOOM_RADII = [3, 5, 7, 9, 11] as const;

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';
const subscribeReducedMotion = (onChange: () => void) => {
  const media = window.matchMedia?.(reducedMotionQuery);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
};
const getReducedMotion = () => window.matchMedia?.(reducedMotionQuery).matches ?? false;
const usePrefersReducedMotion = () =>
  useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);

const subscribeHtmlState = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-nebula-theme', 'data-window-hidden'],
  });
  return () => observer.disconnect();
};

const getHtmlSnapshot = () => {
  const root = document.documentElement;
  return [
    root.classList.contains('dark') ? '1' : '0',
    root.getAttribute('data-nebula-theme') ?? '',
    root.style.getPropertyValue('--color-primary'),
    root.hasAttribute('data-window-hidden') ? '1' : '0',
  ].join('|');
};

const useHtmlState = () => useSyncExternalStore(subscribeHtmlState, getHtmlSnapshot, () => '1|||0');

const readActivePalette = (): { palette: NebulaPalette; isDark: boolean } => {
  const root = document.documentElement;
  const isDark = root.classList.contains('dark');
  const preset = root.getAttribute('data-nebula-theme');
  let primaryRgb: [number, number, number] | null = null;
  const rawPrimary = getComputedStyle(root).getPropertyValue('--color-primary').trim();
  if (rawPrimary) {
    const parts = rawPrimary.split(/[\s,]+/).map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      primaryRgb = [parts[0], parts[1], parts[2]];
    } else if (rawPrimary.startsWith('rgb')) {
      primaryRgb = parseRgb(rawPrimary);
    }
  }
  return { palette: resolveNebulaPalette(preset, primaryRgb), isDark };
};

/* ─── WebGL2 Shaders ──────────────────────────────────────────────────────── */

const PARTICLE_VERT = `#version 300 es
precision highp float;

layout(location = 0) in vec4 aPositionEnergy;
layout(location = 1) in vec3 aColor;
layout(location = 2) in vec2 aSeed;

uniform mat4 uView;
uniform mat4 uProj;
uniform float uPointScale;
uniform float uTime;
uniform vec3 uHighlight;

out vec3 vColor;
out float vAlpha;

void main() {
  vec3 pos = aPositionEnergy.xyz;
  float energy = aPositionEnergy.w;

  vec4 mvPos = uView * vec4(pos, 1.0);
  float dist = max(1.1, -mvPos.z);

  float twinkle = 0.86 + 0.14 * sin(uTime * 1.9 + aSeed.y);
  float depthFade = clamp(1.22 - dist * 0.105, 0.28, 1.0);

  gl_PointSize = clamp(
    uPointScale * aSeed.x * (8.6 / dist) * (1.0 + energy * 0.42),
    1.15,
    14.0
  );
  gl_Position = uProj * mvPos;

  vec3 energized = mix(aColor, uHighlight, clamp(energy * 0.62, 0.0, 0.85));
  vColor = energized * (0.95 + energy * 1.15) * twinkle;
  vAlpha = (0.44 + energy * 0.44) * depthFade;
}
`;

const PARTICLE_FRAG = `#version 300 es
precision highp float;

in vec3 vColor;
in float vAlpha;

out vec4 fragColor;

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  float d = length(centered);
  if (d > 0.5) discard;

  // Crisp glowing core with silky anti-aliased radial halo
  float core = exp(-d * d * 15.0);
  float halo = smoothstep(0.5, 0.06, d) * 0.52;
  float strength = (core + halo) * vAlpha;

  fragColor = vec4(vColor * strength, strength);
}
`;

const FULLSCREEN_VERT = `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 pos = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`;

const THRESHOLD_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSource;
uniform float uThreshold;

out vec4 fragColor;

void main() {
  vec4 texel = texture(uSource, vUv);
  float luma = dot(texel.rgb, vec3(0.2126, 0.7152, 0.0722));
  float mask = smoothstep(uThreshold, uThreshold + 0.14, luma);
  fragColor = vec4(texel.rgb * mask, 1.0);
}
`;

const BLUR_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform int uRadius;

out vec4 fragColor;

float gaussian(float x, float sigma) {
  return 0.39894228 * exp(-0.5 * x * x / (sigma * sigma)) / sigma;
}

void main() {
  float sigma = float(uRadius);
  float w0 = gaussian(0.0, sigma);
  vec3 sum = texture(uSource, vUv).rgb * w0;
  float weightSum = w0;

  for (int i = 1; i <= 11; i++) {
    if (i > uRadius) break;
    float fi = float(i);
    float w = gaussian(fi, sigma);
    vec2 offset = uDirection * uTexelSize * fi;
    sum += (texture(uSource, vUv + offset).rgb + texture(uSource, vUv - offset).rgb) * w;
    weightSum += 2.0 * w;
  }

  fragColor = vec4(sum / weightSum, 1.0);
}
`;

const COMPOSITE_FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom0;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform sampler2D uBloom4;
uniform float uBloomStrength;
uniform float uBloomRadius;
uniform vec3 uAmbient;
uniform vec3 uHighlight;
uniform vec2 uPointerUv;
uniform float uPointerGlow;
uniform float uIsDark;

out vec4 fragColor;

float bloomWeight(float factor) {
  return mix(factor, 1.2 - factor, uBloomRadius);
}

vec3 acesToneMap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;

  vec3 bloom =
    bloomWeight(1.0) * texture(uBloom0, vUv).rgb +
    bloomWeight(0.8) * texture(uBloom1, vUv).rgb +
    bloomWeight(0.6) * texture(uBloom2, vUv).rgb +
    bloomWeight(0.4) * texture(uBloom3, vUv).rgb +
    bloomWeight(0.2) * texture(uBloom4, vUv).rgb;

  // Deep-space atmospheric nebula glow anchored on the left, trailing smoothly right
  vec2 fromCenter = (vUv - vec2(0.36, 0.5)) * vec2(1.1, 1.0);
  float radial = exp(-dot(fromCenter, fromCenter) * 3.1);
  vec3 backdrop = uAmbient * radial * 0.92;

  // Subtle reactive cursor glow halo inside the nebula
  vec2 toPointer = vUv - uPointerUv;
  float cursorGlow = exp(-dot(toPointer, toPointer) * 28.0) * uPointerGlow;
  vec3 pointerLight = uHighlight * cursorGlow * 0.12;

  vec3 hdr = backdrop + pointerLight + scene + bloom * uBloomStrength;
  vec3 mapped = acesToneMap(hdr * 1.08);

  // Slow, seamless right-to-left fade across the panel into the login background
  float linearFade = smoothstep(0.98, 0.24, vUv.x);
  float rightFade = pow(linearFade, 1.45);
  vec3 baseSpace = mix(vec3(0.014, 0.024, 0.052), vec3(0.0), uIsDark);
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  vec3 finalRgb = max(vec3(0.0), (baseSpace + mapped) * rightFade + dither * rightFade);

  fragColor = vec4(finalRgb, rightFade);
}
`;

/* ─── WebGL2 Pipeline Helper ──────────────────────────────────────────────── */

interface RenderTarget {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  width: number;
  height: number;
}

const compileShader = (gl: WebGL2RenderingContext, type: number, source: string): WebGLShader => {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Unable to create WebGL2 shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader) || 'Unknown shader compile error';
    gl.deleteShader(shader);
    throw new Error(info);
  }
  return shader;
};

const createProgram = (gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram => {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error('Unable to create WebGL2 program');
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program) || 'Unknown program link error';
    gl.deleteProgram(program);
    throw new Error(info);
  }
  return program;
};

const createRenderTarget = (
  gl: WebGL2RenderingContext,
  width: number,
  height: number,
  useHalfFloat: boolean,
): RenderTarget => {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    useHalfFloat ? gl.RGBA16F : gl.RGBA8,
    w,
    h,
    0,
    gl.RGBA,
    useHalfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
    null,
  );

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return { fbo, tex, width: w, height: h };
};

const disposeRenderTarget = (gl: WebGL2RenderingContext, rt: RenderTarget | null) => {
  if (!rt) return;
  gl.deleteFramebuffer(rt.fbo);
  gl.deleteTexture(rt.tex);
};

interface NebulaRenderer {
  resize: (width: number, height: number, dpr: number) => void;
  updatePalette: (palette: NebulaPalette, isDark: boolean) => void;
  render: (
    state: NebulaSimulationState,
    view: Float32Array,
    proj: Float32Array,
    timeSec: number,
    pointerUvX: number,
    pointerUvY: number,
    pointerGlow: number,
  ) => void;
  dispose: () => void;
}

const createWebGL2Renderer = (
  canvas: HTMLCanvasElement,
  state: NebulaSimulationState,
  initialPalette: NebulaPalette,
  initialIsDark: boolean,
): NebulaRenderer | null => {
  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    premultipliedAlpha: true,
  });
  if (!gl) return null;

  let particleProg: WebGLProgram;
  let thresholdProg: WebGLProgram;
  let blurProg: WebGLProgram;
  let compositeProg: WebGLProgram;
  try {
    particleProg = createProgram(gl, PARTICLE_VERT, PARTICLE_FRAG);
    thresholdProg = createProgram(gl, FULLSCREEN_VERT, THRESHOLD_FRAG);
    blurProg = createProgram(gl, FULLSCREEN_VERT, BLUR_FRAG);
    compositeProg = createProgram(gl, FULLSCREEN_VERT, COMPOSITE_FRAG);
  } catch {
    return null;
  }

  // Probe HDR half-float FBO support (available on all modern desktop/Electron GPUs)
  let useHalfFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));
  if (useHalfFloat) {
    const probe = createRenderTarget(gl, 4, 4, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, probe.fbo);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    disposeRenderTarget(gl, probe);
    if (!complete) useHalfFloat = false;
  }

  // Geometry VAO + buffers
  const particleVao = gl.createVertexArray()!;
  gl.bindVertexArray(particleVao);

  const posBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, state.positions, gl.STREAM_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

  const colBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, state.colors, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  const seedBuf = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf);
  gl.bufferData(gl.ARRAY_BUFFER, state.seeds, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const quadVao = gl.createVertexArray()!;

  // Uniform locations
  const uView = gl.getUniformLocation(particleProg, 'uView');
  const uProj = gl.getUniformLocation(particleProg, 'uProj');
  const uPointScale = gl.getUniformLocation(particleProg, 'uPointScale');
  const uTime = gl.getUniformLocation(particleProg, 'uTime');
  const uHighlightP = gl.getUniformLocation(particleProg, 'uHighlight');

  const uThreshSource = gl.getUniformLocation(thresholdProg, 'uSource');
  const uThreshVal = gl.getUniformLocation(thresholdProg, 'uThreshold');

  const uBlurSource = gl.getUniformLocation(blurProg, 'uSource');
  const uBlurTexel = gl.getUniformLocation(blurProg, 'uTexelSize');
  const uBlurDir = gl.getUniformLocation(blurProg, 'uDirection');
  const uBlurRadius = gl.getUniformLocation(blurProg, 'uRadius');

  const uCompScene = gl.getUniformLocation(compositeProg, 'uScene');
  const uCompBlooms = Array.from({ length: BLOOM_MIPS }, (_, i) =>
    gl.getUniformLocation(compositeProg, `uBloom${i}`),
  );
  const uCompStrength = gl.getUniformLocation(compositeProg, 'uBloomStrength');
  const uCompRadius = gl.getUniformLocation(compositeProg, 'uBloomRadius');
  const uCompAmbient = gl.getUniformLocation(compositeProg, 'uAmbient');
  const uCompHighlight = gl.getUniformLocation(compositeProg, 'uHighlight');
  const uCompPointerUv = gl.getUniformLocation(compositeProg, 'uPointerUv');
  const uCompPointerGlow = gl.getUniformLocation(compositeProg, 'uPointerGlow');
  const uCompIsDark = gl.getUniformLocation(compositeProg, 'uIsDark');

  let sceneRt: RenderTarget | null = null;
  let brightRt: RenderTarget | null = null;
  let blurH: RenderTarget[] = [];
  let blurV: RenderTarget[] = [];
  let pixelWidth = 1;
  let pixelHeight = 1;
  let currentDpr = 1;
  let palette = initialPalette;
  let isDark = initialIsDark;

  const disposeTargets = () => {
    disposeRenderTarget(gl, sceneRt);
    disposeRenderTarget(gl, brightRt);
    for (const rt of blurH) disposeRenderTarget(gl, rt);
    for (const rt of blurV) disposeRenderTarget(gl, rt);
    sceneRt = null;
    brightRt = null;
    blurH = [];
    blurV = [];
  };

  const resize = (width: number, height: number, dpr: number) => {
    currentDpr = dpr;
    pixelWidth = Math.max(1, Math.round(width * dpr));
    pixelHeight = Math.max(1, Math.round(height * dpr));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    disposeTargets();
    sceneRt = createRenderTarget(gl, pixelWidth, pixelHeight, useHalfFloat);
    let mw = Math.max(2, Math.floor(pixelWidth / 2));
    let mh = Math.max(2, Math.floor(pixelHeight / 2));
    brightRt = createRenderTarget(gl, mw, mh, useHalfFloat);

    for (let i = 0; i < BLOOM_MIPS; i++) {
      blurH.push(createRenderTarget(gl, mw, mh, useHalfFloat));
      blurV.push(createRenderTarget(gl, mw, mh, useHalfFloat));
      mw = Math.max(2, Math.floor(mw / 2));
      mh = Math.max(2, Math.floor(mh / 2));
    }
  };

  const updatePalette = (nextPalette: NebulaPalette, nextIsDark: boolean) => {
    palette = nextPalette;
    isDark = nextIsDark;
    gl.bindBuffer(gl.ARRAY_BUFFER, colBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, state.colors);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  };

  const render = (
    simState: NebulaSimulationState,
    view: Float32Array,
    proj: Float32Array,
    timeSec: number,
    pointerUvX: number,
    pointerUvY: number,
    pointerGlow: number,
  ) => {
    if (!sceneRt || !brightRt || blurV.length < BLOOM_MIPS) return;

    // Upload updated particle positions + energy in a single GPU transfer
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, simState.positions);

    // Pass 1: Additive 50k particles into scene FBO
    gl.bindFramebuffer(gl.FRAMEBUFFER, sceneRt.fbo);
    gl.viewport(0, 0, sceneRt.width, sceneRt.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(particleProg);
    gl.uniformMatrix4fv(uView, false, view);
    gl.uniformMatrix4fv(uProj, false, proj);
    gl.uniform1f(uPointScale, 1.32 * currentDpr);
    gl.uniform1f(uTime, timeSec);
    gl.uniform3fv(uHighlightP, palette.highlightRgb);

    gl.bindVertexArray(particleVao);
    gl.drawArrays(gl.POINTS, 0, simState.count);

    // Post-processing passes run opaque
    gl.disable(gl.BLEND);
    gl.bindVertexArray(quadVao);

    // Pass 2: Luminance threshold -> half-res bright buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, brightRt.fbo);
    gl.viewport(0, 0, brightRt.width, brightRt.height);
    gl.useProgram(thresholdProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneRt.tex);
    gl.uniform1i(uThreshSource, 0);
    gl.uniform1f(uThreshVal, 0.085);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // Pass 3: 5-mip separable Gaussian blur chain (UnrealBloomPass architecture)
    gl.useProgram(blurProg);
    gl.uniform1i(uBlurSource, 0);
    let inputTex = brightRt.tex;
    for (let i = 0; i < BLOOM_MIPS; i++) {
      const rtH = blurH[i];
      const rtV = blurV[i];
      const radius = BLOOM_RADII[i];

      gl.uniform1i(uBlurRadius, radius);

      // Horizontal blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, rtH.fbo);
      gl.viewport(0, 0, rtH.width, rtH.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, inputTex);
      gl.uniform2f(uBlurTexel, 1 / rtH.width, 1 / rtH.height);
      gl.uniform2f(uBlurDir, 1, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // Vertical blur
      gl.bindFramebuffer(gl.FRAMEBUFFER, rtV.fbo);
      gl.viewport(0, 0, rtV.width, rtV.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, rtH.tex);
      gl.uniform2f(uBlurTexel, 1 / rtV.width, 1 / rtV.height);
      gl.uniform2f(uBlurDir, 0, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      inputTex = rtV.tex;
    }

    // Pass 4: Composite scene + 5 bloom mips + ACES filmic tone map to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.useProgram(compositeProg);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneRt.tex);
    gl.uniform1i(uCompScene, 0);

    for (let i = 0; i < BLOOM_MIPS; i++) {
      gl.activeTexture(gl.TEXTURE1 + i);
      gl.bindTexture(gl.TEXTURE_2D, blurV[i].tex);
      gl.uniform1i(uCompBlooms[i], 1 + i);
    }

    gl.uniform1f(uCompStrength, 0.68);
    gl.uniform1f(uCompRadius, 0.42);
    gl.uniform3fv(uCompAmbient, palette.ambientRgb);
    gl.uniform3fv(uCompHighlight, palette.highlightRgb);
    gl.uniform2f(uCompPointerUv, pointerUvX, pointerUvY);
    gl.uniform1f(uCompPointerGlow, pointerGlow);
    gl.uniform1f(uCompIsDark, isDark ? 1.0 : 0.0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  };

  const dispose = () => {
    disposeTargets();
    gl.deleteBuffer(posBuf);
    gl.deleteBuffer(colBuf);
    gl.deleteBuffer(seedBuf);
    gl.deleteVertexArray(particleVao);
    gl.deleteVertexArray(quadVao);
    gl.deleteProgram(particleProg);
    gl.deleteProgram(thresholdProg);
    gl.deleteProgram(blurProg);
    gl.deleteProgram(compositeProg);
  };

  return { resize, updatePalette, render, dispose };
};

/* ─── Graceful Canvas 2D Fallback (if WebGL2 is unavailable) ──────────────── */

const createFallback2DRenderer = (
  canvas: HTMLCanvasElement,
  initialPalette: NebulaPalette,
): NebulaRenderer | null => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  let width = 1;
  let height = 1;
  let palette = initialPalette;

  return {
    resize: (w, h, dpr) => {
      width = Math.max(1, w);
      height = Math.max(1, h);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
    updatePalette: (nextPalette) => {
      palette = nextPalette;
    },
    render: (simState, view, proj) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const [ar, ag, ab] = palette.ambientRgb;
      const grad = ctx.createRadialGradient(
        width * 0.47,
        height * 0.5,
        0,
        width * 0.47,
        height * 0.5,
        Math.max(width, height) * 0.58,
      );
      grad.addColorStop(0, `rgba(${Math.round(ar * 255)}, ${Math.round(ag * 255)}, ${Math.round(ab * 255)}, 0.45)`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw an evenly-strided subset for smooth 2D performance
      const stride = Math.max(1, Math.floor(simState.count / 2400));
      const { positions, colors } = simState;
      const halfW = width * 0.5;
      const halfH = height * 0.5;

      for (let i = 0; i < simState.count; i += stride) {
        const i4 = i * 4;
        const px = positions[i4];
        const py = positions[i4 + 1];
        const pz = positions[i4 + 2];
        const energy = positions[i4 + 3];

        const vx = view[0] * px + view[4] * py + view[8] * pz + view[12];
        const vy = view[1] * px + view[5] * py + view[9] * pz + view[13];
        const vz = view[2] * px + view[6] * py + view[10] * pz + view[14];
        const w = -vz;
        if (w <= 0.2) continue;

        const sx = ((proj[0] * vx) / w) * halfW + halfW;
        const sy = halfH - ((proj[5] * vy) / w) * halfH;
        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;

        const i3 = i * 3;
        const r = Math.min(255, Math.round((colors[i3] + energy * 0.4) * 255));
        const g = Math.min(255, Math.round((colors[i3 + 1] + energy * 0.4) * 255));
        const b = Math.min(255, Math.round((colors[i3 + 2] + energy * 0.4) * 255));
        const size = Math.max(1.1, (7.5 / w) * (1 + energy * 0.35));
        ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(0.9, 0.38 + energy * 0.4)})`;
        ctx.fillRect(sx - size * 0.5, sy - size * 0.5, size, size);
      }
      ctx.globalCompositeOperation = 'destination-in';
      const fadeMask = ctx.createLinearGradient(0, 0, width, 0);
      fadeMask.addColorStop(0, 'rgba(0, 0, 0, 1)');
      fadeMask.addColorStop(0.28, 'rgba(0, 0, 0, 1)');
      fadeMask.addColorStop(0.62, 'rgba(0, 0, 0, 0.35)');
      fadeMask.addColorStop(0.98, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = fadeMask;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    },
    dispose: () => {},
  };
};

/* ─── React Component ─────────────────────────────────────────────────────── */

export const QuantumNebula: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visible = useDocumentVisible();
  const reducedMotion = usePrefersReducedMotion();
  const htmlState = useHtmlState();
  const [isHolding, setIsHolding] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const dotColor = useMemo(() => {
    const { palette } = readActivePalette();
    return `hsla(${Math.round(palette.baseHue)}, ${Math.round(palette.saturation * 100)}%, 72%, 0.85)`;
  }, [htmlState]);

  const windowHidden = htmlState.endsWith('|1');
  const running = visible && !windowHidden && !reducedMotion;
  const runningRef = useRef(running);
  const resumeRef = useRef<(() => void) | null>(null);
  const paletteSyncRef = useRef<(() => void) | null>(null);

  const pointerRef = useRef({
    targetNdcX: 0,
    targetNdcY: 0,
    smoothNdcX: 0,
    smoothNdcY: 0,
    parallaxNdcX: 0,
    parallaxNdcY: 0,
    prevWorldX: 0,
    prevWorldY: 0,
    velX: 0,
    velY: 0,
    active: false,
    pressed: false,
    glow: 0,
    pulseX: 0,
    pulseY: 0,
    pulseRadius: 0,
    pulseStrength: 0,
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const initial = readActivePalette();
    const simState = createNebulaState(initial.palette, QUANTUM_NEBULA_CONFIG);

    const renderer =
      createWebGL2Renderer(canvas, simState, initial.palette, initial.isDark) ??
      createFallback2DRenderer(canvas, initial.palette);
    if (!renderer) return;

    const viewMatrix = new Float32Array(16);
    const projMatrix = new Float32Array(16);
    const cam = { x: 0, y: 0, z: QUANTUM_NEBULA_CONFIG.cameraDistance };

    let cssWidth = 0;
    let cssHeight = 0;
    let aspect = 1;
    let rafId = 0;
    let lastNow = performance.now();
    let elapsedSec = 0;
    let disposed = false;

    const interaction: NebulaInteraction = {
      pointerX: 0,
      pointerY: 0,
      pointerVelX: 0,
      pointerVelY: 0,
      active: false,
      pressed: false,
      aspect: 1,
      pulseX: 0,
      pulseY: 0,
      pulseRadius: 0,
      pulseStrength: 0,
    };

    const paintFrame = (dtSec: number, advancePhysics: boolean) => {
      if (disposed || cssWidth <= 0 || cssHeight <= 0) return;

      const ptr = pointerRef.current;
      const follow = 1 - Math.pow(0.0018, dtSec);
      ptr.smoothNdcX += (ptr.targetNdcX - ptr.smoothNdcX) * follow;
      ptr.smoothNdcY += (ptr.targetNdcY - ptr.smoothNdcY) * follow;

      const [wx, wy] = projectPointerToWorld(
        ptr.smoothNdcX,
        ptr.smoothNdcY,
        aspect,
        cam.z,
        QUANTUM_NEBULA_CONFIG.fovDeg,
      );
      if (ptr.active) {
        ptr.velX = ptr.velX * 0.65 + (wx - ptr.prevWorldX) * 0.35;
        ptr.velY = ptr.velY * 0.65 + (wy - ptr.prevWorldY) * 0.35;
      } else {
        ptr.velX *= 0.85;
        ptr.velY *= 0.85;
      }
      ptr.prevWorldX = wx;
      ptr.prevWorldY = wy;

      const targetGlow = ptr.pressed ? 1.0 : ptr.active ? 0.55 : 0.0;
      ptr.glow += (targetGlow - ptr.glow) * Math.min(1, dtSec * 8);

      if (ptr.pulseStrength > 0.002) {
        ptr.pulseRadius += QUANTUM_NEBULA_CONFIG.shockwaveSpeed * dtSec;
        ptr.pulseStrength *= Math.pow(0.18, dtSec);
      } else {
        ptr.pulseStrength = 0;
      }

      interaction.pointerX = ptr.smoothNdcX;
      interaction.pointerY = ptr.smoothNdcY;
      interaction.pointerVelX = ptr.velX;
      interaction.pointerVelY = ptr.velY;
      interaction.active = ptr.active;
      interaction.pressed = ptr.pressed;
      interaction.aspect = aspect;
      interaction.pulseX = ptr.pulseX;
      interaction.pulseY = ptr.pulseY;
      interaction.pulseRadius = ptr.pulseRadius;
      interaction.pulseStrength = ptr.pulseStrength;

      if (advancePhysics) {
        elapsedSec += dtSec;
        stepNebulaSimulation(simState, dtSec, elapsedSec, interaction, QUANTUM_NEBULA_CONFIG);
      }

      // Smooth 3D camera parallax following cursor across the window
      const parallax = QUANTUM_NEBULA_CONFIG.parallaxIntensity;
      const camLerp = 1 - Math.pow(0.05, dtSec);
      cam.x += (ptr.parallaxNdcX * parallax - cam.x) * camLerp;
      cam.y += (-ptr.parallaxNdcY * parallax * 0.85 - cam.y) * camLerp;

      writeCameraMatrices(
        viewMatrix,
        projMatrix,
        aspect,
        cam.x,
        cam.y,
        cam.z,
        QUANTUM_NEBULA_CONFIG.fovDeg,
      );

      renderer.render(
        simState,
        viewMatrix,
        projMatrix,
        elapsedSec,
        ptr.smoothNdcX * 0.5 + 0.5,
        ptr.smoothNdcY * 0.5 + 0.5,
        ptr.glow,
      );
    };

    const syncSize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === cssWidth && height === cssHeight) return;
      cssWidth = width;
      cssHeight = height;
      if (width <= 0 || height <= 0) return;
      aspect = width / height;
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      renderer.resize(width, height, dpr);
      paintFrame(1 / 60, false);
    };

    const loop = (now: number) => {
      rafId = 0;
      if (disposed || !runningRef.current) return;
      rafId = requestAnimationFrame(loop);
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
      lastNow = now;
      if (cssWidth > 0 && cssHeight > 0) {
        paintFrame(dtSec, true);
      }
    };

    const resume = () => {
      if (disposed || rafId || !runningRef.current) return;
      lastNow = performance.now();
      rafId = requestAnimationFrame(loop);
    };
    resumeRef.current = resume;

    paletteSyncRef.current = () => {
      if (disposed) return;
      const next = readActivePalette();
      recolorNebulaState(simState, next.palette);
      renderer.updatePalette(next.palette, next.isDark);
      if (!runningRef.current) paintFrame(1 / 60, false);
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      if (window.innerWidth > 0 && window.innerHeight > 0) {
        pointerRef.current.parallaxNdcX = (e.clientX / window.innerWidth) * 2 - 1;
        pointerRef.current.parallaxNdcY = (e.clientY / window.innerHeight) * 2 - 1;
      }
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafId);
      rafId = 0;
    };

    syncSize();
    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(container);
    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    canvas.addEventListener('webglcontextlost', handleContextLost, false);

    resume();

    return () => {
      disposed = true;
      resumeRef.current = null;
      paletteSyncRef.current = null;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      window.removeEventListener('pointermove', handleWindowPointerMove);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    runningRef.current = running;
    if (running) resumeRef.current?.();
  }, [running]);

  useEffect(() => {
    paletteSyncRef.current?.();
  }, [htmlState]);

  const updateLocalPointer = (clientX: number, clientY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
    const ptr = pointerRef.current;
    ptr.targetNdcX = Math.max(-1.05, Math.min(1.05, ndcX));
    ptr.targetNdcY = Math.max(-1.05, Math.min(1.05, ndcY));
    if (!ptr.active) {
      ptr.smoothNdcX = ptr.targetNdcX;
      ptr.smoothNdcY = ptr.targetNdcY;
      ptr.active = true;
    }
  };

  const triggerShockwave = () => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const aspect = rect.height > 0 ? rect.width / rect.height : 1;
    const ptr = pointerRef.current;
    const [wx, wy] = projectPointerToWorld(
      ptr.smoothNdcX,
      ptr.smoothNdcY,
      aspect,
      QUANTUM_NEBULA_CONFIG.cameraDistance,
      QUANTUM_NEBULA_CONFIG.fovDeg,
    );
    ptr.pulseX = wx;
    ptr.pulseY = wy;
    ptr.pulseRadius = 0.08;
    ptr.pulseStrength = 1.0;
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    updateLocalPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    updateLocalPointer(e.clientX, e.clientY);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    updateLocalPointer(e.clientX, e.clientY);
    pointerRef.current.pressed = true;
    setIsHolding(true);
    setHasInteracted(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const releaseHold = (launchWave: boolean) => {
    const wasPressed = pointerRef.current.pressed;
    pointerRef.current.pressed = false;
    setIsHolding(false);
    if (wasPressed && launchWave) {
      triggerShockwave();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    releaseHold(true);
    const rect = containerRef.current?.getBoundingClientRect();
    if (
      rect &&
      (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
    ) {
      pointerRef.current.active = false;
    }
  };

  const handlePointerCancel = () => {
    releaseHold(false);
  };

  const handlePointerLeave = () => {
    if (!pointerRef.current.pressed) {
      pointerRef.current.active = false;
    }
  };

  return (
    <div
      ref={containerRef}
      data-nebula-quantum-scene="true"
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      className={`relative h-full w-full select-none touch-none overflow-hidden ${isHolding ? 'cursor-grabbing' : 'cursor-default'}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      {!reducedMotion && (
        <div
          className={`pointer-events-none absolute bottom-5 left-6 flex items-center gap-2 text-[11px] font-medium tracking-wide text-white/45 transition-opacity duration-700 ${
            hasInteracted ? 'opacity-20' : 'opacity-65'
          }`}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
          <span>Move to ripple · Hold to pull</span>
        </div>
      )}
    </div>
  );
};
