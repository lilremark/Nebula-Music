/**
 * Pure simulation and math engine for the interactive Quantum Nebula canvas.
 *
 * Implements a 50,000-particle 3D curl-noise nebula (inspired by 21st.dev's
 * Quantum Nebula) with zero per-frame object allocations, frame-rate
 * independent physics, accurate pointer projection, hover repulsion,
 * click-and-hold gravitational vortex, and release shockwaves.
 */

export interface QuantumNebulaConfig {
  readonly particleCount: number;
  readonly boxSize: number;
  readonly noiseSpeed: number;
  readonly noiseScale: number;
  readonly curlForce: number;
  readonly friction: number;
  readonly hoverRadius: number;
  readonly mouseRepulsion: number;
  readonly hoverSwirl: number;
  readonly vortexRadius: number;
  readonly vortexAttraction: number;
  readonly vortexSwirl: number;
  readonly shockwaveSpeed: number;
  readonly shockwaveImpulse: number;
  readonly cameraDistance: number;
  readonly fovDeg: number;
  readonly parallaxIntensity: number;
  readonly prewarmSteps: number;
}

export const QUANTUM_NEBULA_CONFIG: QuantumNebulaConfig = {
  particleCount: 50_000,
  boxSize: 5.2,
  noiseSpeed: 0.11,
  noiseScale: 1.2,
  curlForce: 0.0011,
  friction: 0.95,
  hoverRadius: 2.05,
  mouseRepulsion: 0.0062,
  hoverSwirl: 0.0022,
  vortexRadius: 2.85,
  vortexAttraction: 0.0085,
  vortexSwirl: 0.0115,
  shockwaveSpeed: 5.4,
  shockwaveImpulse: 0.072,
  cameraDistance: 5.0,
  fovDeg: 75,
  parallaxIntensity: 0.42,
  prewarmSteps: 14,
};

export interface NebulaPalette {
  /** Primary hue in degrees [0, 360). */
  baseHue: number;
  /** Hue spread across particles in degrees. */
  hueVariance: number;
  /** Saturation in [0, 1]. */
  saturation: number;
  /** Lightness in [0, 1]. */
  lightness: number;
  /** Secondary highlight colour blended in on energized/disturbed particles (RGB 0..1). */
  highlightRgb: [number, number, number];
  /** Faint atmospheric nebula core tint (RGB 0..1). */
  ambientRgb: [number, number, number];
}

export interface NebulaInteraction {
  /** Pointer normalized device X in [-1, 1] relative to the nebula canvas. */
  pointerX: number;
  /** Pointer normalized device Y in [-1, 1] relative to the nebula canvas (+Y up). */
  pointerY: number;
  /** Smoothed pointer velocity in world units per 60Hz frame. */
  pointerVelX: number;
  pointerVelY: number;
  /** True while the pointer is hovering inside the nebula panel. */
  active: boolean;
  /** True while the primary pointer button is held down (gravitational vortex). */
  pressed: boolean;
  /** Canvas aspect ratio (width / height) used to project pointer onto z = 0 plane. */
  aspect: number;
  /** Active shockwave ring state (triggered on pointer release). */
  pulseX: number;
  pulseY: number;
  pulseRadius: number;
  pulseStrength: number;
}

export interface NebulaSimulationState {
  readonly count: number;
  readonly boxSize: number;
  /** Interleaved vec4 per particle: [x, y, z, energy] (length = count * 4). */
  readonly positions: Float32Array;
  /** Particle velocities: [vx, vy, vz] (length = count * 3). */
  readonly velocities: Float32Array;
  /** Particle base RGB colours in [0, 1]: [r, g, b] (length = count * 3). */
  readonly colors: Float32Array;
  /** Per-particle visual attributes: [sizeScale, phase] (length = count * 2). */
  readonly seeds: Float32Array;
}

export const hslToRgb = (hDeg: number, s: number, l: number): [number, number, number] => {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  if (s <= 0.0001) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue2rgb = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [hue2rgb(h + 1 / 3), hue2rgb(h), hue2rgb(h - 1 / 3)];
};

export const rgbToHsl = (r255: number, g255: number, b255: number): [number, number, number] => {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
};

const DEFAULT_PRIMARY_RGB: [number, number, number] = [83, 104, 216]; // Nebula defaultAccent (#5368d8)

/**
 * Resolves the Quantum Nebula particle palette from the active theme's primary
 * colour (`--color-primary`), keeping brightness in a luminous range suited
 * for additive particles and bloom on a deep-space backdrop.
 */
export const resolveNebulaPalette = (
  themePreset: string | null,
  primaryRgb?: [number, number, number] | null,
): NebulaPalette => {
  if (themePreset === 'ascii-mono') {
    return {
      baseHue: 210,
      hueVariance: 8,
      saturation: 0.05,
      lightness: 0.78,
      highlightRgb: [1.0, 1.0, 1.0],
      ambientRgb: [0.06, 0.06, 0.08],
    };
  }

  const isValidRgb =
    primaryRgb != null &&
    primaryRgb.every((c) => Number.isFinite(c)) &&
    // Treat the uninitialized index.css fallback (0, 0, 0) as unset so boot never flashes monochrome black
    (primaryRgb[0] > 4 || primaryRgb[1] > 4 || primaryRgb[2] > 4);

  const rgb = isValidRgb ? primaryRgb : DEFAULT_PRIMARY_RGB;
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);

  if (s <= 0.08) {
    return {
      baseHue: 210,
      hueVariance: 8,
      saturation: 0.05,
      lightness: 0.78,
      highlightRgb: [1.0, 1.0, 1.0],
      ambientRgb: [0.06, 0.06, 0.08],
    };
  }

  const saturation = Math.max(0.55, Math.min(0.98, s * 1.08));
  const lightness = Math.max(0.52, Math.min(0.66, l * 0.55 + 0.28));
  const highlightRgb = hslToRgb(h - 8, Math.min(1, saturation * 0.65 + 0.15), 0.87);
  const ambientRgb = hslToRgb(h, Math.min(0.85, saturation), 0.12);

  return {
    baseHue: h,
    hueVariance: 24,
    saturation,
    lightness,
    highlightRgb,
    ambientRgb,
  };
};

/** Fast deterministic PRNG (Mulberry32) so tests and initial clouds are clean and repeatable. */
const createRng = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const recolorNebulaState = (
  state: NebulaSimulationState,
  palette: NebulaPalette,
  seed = 1337,
): void => {
  const rand = createRng(seed);
  const { count, colors } = state;
  for (let i = 0; i < count; i++) {
    const u = rand();
    const hueShift = (u - 0.5) * palette.hueVariance;
    // Slight secondary violet/teal whisper on ~14% of particles for cosmic depth
    const accentShift = rand() > 0.86 ? palette.hueVariance * 0.7 : 0;
    const sat = Math.max(0, Math.min(1, palette.saturation - rand() * 0.08));
    const lit = Math.max(0.32, Math.min(0.88, palette.lightness + (rand() - 0.5) * 0.16));
    const [r, g, b] = hslToRgb(palette.baseHue + hueShift + accentShift, sat, lit);
    const i3 = i * 3;
    colors[i3] = r;
    colors[i3 + 1] = g;
    colors[i3 + 2] = b;
  }
};

export const createNebulaState = (
  palette: NebulaPalette,
  config: QuantumNebulaConfig = QUANTUM_NEBULA_CONFIG,
  seed = 42069,
): NebulaSimulationState => {
  const count = config.particleCount;
  const boxSize = config.boxSize;
  const positions = new Float32Array(count * 4);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);

  const rand = createRng(seed);

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    positions[i4] = (rand() - 0.5) * boxSize;
    positions[i4 + 1] = (rand() - 0.5) * boxSize;
    positions[i4 + 2] = (rand() - 0.5) * boxSize;
    positions[i4 + 3] = 0;

    const i2 = i * 2;
    // Mix of fine dust and occasional brighter starlet nodes
    const sizeRand = rand();
    seeds[i2] = sizeRand > 0.94 ? 1.55 + rand() * 0.65 : 0.72 + sizeRand * 0.68;
    seeds[i2 + 1] = rand() * Math.PI * 2;
  }

  const state: NebulaSimulationState = { count, boxSize, positions, velocities, colors, seeds };
  recolorNebulaState(state, palette, seed + 17);

  // Pre-warm the curl-noise simulation so flowing filaments appear immediately on frame 1.
  const idleInteraction: NebulaInteraction = {
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
  for (let step = 0; step < config.prewarmSteps; step++) {
    stepNebulaSimulation(state, 2 / 60, step * (2 / 60), idleInteraction, config);
  }
  // Settle initial energy to calm baseline after pre-warming.
  for (let i = 0; i < count; i++) {
    positions[i * 4 + 3] = 0;
  }

  return state;
};

/**
 * Projects normalized pointer coordinates [-1, 1] onto the z = 0 world plane
 * so interactive forces align directly underneath the user's cursor.
 */
export const projectPointerToWorld = (
  ndcX: number,
  ndcY: number,
  aspect: number,
  camZ: number,
  fovDeg: number,
): [number, number] => {
  const halfH = camZ * Math.tan((fovDeg * Math.PI) / 360);
  const halfW = halfH * Math.max(0.25, aspect);
  return [ndcX * halfW, ndcY * halfH];
};

/**
 * Advances all particles by `dtSeconds`. Zero heap allocations.
 */
export const stepNebulaSimulation = (
  state: NebulaSimulationState,
  dtSeconds: number,
  elapsedSeconds: number,
  interaction: NebulaInteraction,
  config: QuantumNebulaConfig = QUANTUM_NEBULA_CONFIG,
): void => {
  const { count, boxSize, positions, velocities } = state;
  const halfBox = boxSize * 0.5;
  const dt60 = Math.max(0.2, Math.min(2.2, dtSeconds * 60));
  const drag = Math.pow(config.friction, dt60);
  const energyDecay = Math.pow(0.92, dt60);
  const curlForce = config.curlForce * dt60;
  const noiseScale = config.noiseScale;
  const nt = elapsedSeconds * config.noiseSpeed;

  const active = interaction.active;
  const pressed = active && interaction.pressed;

  const [mx, my] = projectPointerToWorld(
    interaction.pointerX,
    interaction.pointerY,
    interaction.aspect,
    config.cameraDistance,
    config.fovDeg,
  );
  const pvX = interaction.pointerVelX * 0.08 * dt60;
  const pvY = interaction.pointerVelY * 0.08 * dt60;

  const hoverRadius = config.hoverRadius;
  const hoverRadiusSq = hoverRadius * hoverRadius;
  const repulseStrength = config.mouseRepulsion * dt60;
  const hoverSwirl = config.hoverSwirl * dt60;

  const vortexRadius = config.vortexRadius;
  const vortexRadiusSq = vortexRadius * vortexRadius;
  const vortexPull = config.vortexAttraction * dt60;
  const vortexSwirl = config.vortexSwirl * dt60;

  const hasPulse = interaction.pulseStrength > 0.002;
  const pulseX = interaction.pulseX;
  const pulseY = interaction.pulseY;
  const pulseR = interaction.pulseRadius;
  const pulseBand = 0.65;
  const pulseAmp = interaction.pulseStrength * config.shockwaveImpulse * dt60;

  for (let i = 0; i < count; i++) {
    const i4 = i * 4;
    const i3 = i * 3;

    let px = positions[i4];
    let py = positions[i4 + 1];
    let pz = positions[i4 + 2];
    let energy = positions[i4 + 3] * energyDecay;

    // 3D curl-like flow field (exact core motion of Quantum Nebula)
    const cx = Math.sin(py * noiseScale + nt);
    const cy = Math.cos(pz * noiseScale + nt);
    const cz = Math.sin(px * noiseScale + nt);
    const cLen = Math.sqrt(cx * cx + cy * cy + cz * cz) || 1;
    const invCLen = curlForce / cLen;

    let vx = velocities[i3] + cx * invCLen;
    let vy = velocities[i3 + 1] + cy * invCLen;
    let vz = velocities[i3 + 2] + cz * invCLen;

    // Interactive pointer forces
    if (pressed) {
      const dx = px - mx;
      const dy = py - my;
      const dz = pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < vortexRadiusSq) {
        const dist = Math.sqrt(distSq) + 0.0001;
        const falloff = 1 - dist / vortexRadius;
        const invDist = 1 / dist;
        const nx = dx * invDist;
        const ny = dy * invDist;
        const nz = dz * invDist;

        // Pull inward toward an orbital ring (radius ~0.32) rather than collapsing to a single pixel
        const radialSign = dist > 0.32 ? -1 : 0.45;
        const pull = radialSign * vortexPull * (0.35 + falloff * 1.15);
        // Tangential orbital spin around the cursor
        const swirl = vortexSwirl * (0.4 + falloff);

        vx += nx * pull - ny * swirl;
        vy += ny * pull + nx * swirl;
        vz += nz * pull * 0.7;
        energy = Math.min(1.4, energy + falloff * 0.22 * dt60);
      }
    } else if (active) {
      const dx = px - mx;
      const dy = py - my;
      const dz = pz;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq < hoverRadiusSq) {
        const dist = Math.sqrt(distSq) + 0.0001;
        const falloff = 1 - dist / hoverRadius;
        const force = (falloff / (dist + 0.14)) * repulseStrength;
        const invDist = 1 / dist;
        const nx = dx * invDist;
        const ny = dy * invDist;
        const nz = dz * invDist;

        // Radial repulsion + organic tangential wake swirl + cursor momentum drag
        vx += nx * force - ny * hoverSwirl * falloff + pvX * falloff;
        vy += ny * force + nx * hoverSwirl * falloff + pvY * falloff;
        vz += nz * force * 0.75;
        energy = Math.min(1.25, energy + falloff * 0.18 * dt60);
      }
    }

    // Expanding shockwave pulse released after a click/hold
    if (hasPulse) {
      const dx = px - pulseX;
      const dy = py - pulseY;
      const dist2D = Math.sqrt(dx * dx + dy * dy) + 0.0001;
      const deltaR = Math.abs(dist2D - pulseR);
      if (deltaR < pulseBand) {
        const wave = 1 - deltaR / pulseBand;
        const waveSq = wave * wave;
        const push = pulseAmp * waveSq;
        vx += (dx / dist2D) * push;
        vy += (dy / dist2D) * push;
        vz += (pz >= 0 ? 1 : -1) * push * 0.28;
        energy = Math.min(1.5, energy + waveSq * interaction.pulseStrength * 0.55);
      }
    }

    vx *= drag;
    vy *= drag;
    vz *= drag;

    px += vx * dt60;
    py += vy * dt60;
    pz += vz * dt60;

    if (px > halfBox || px < -halfBox) {
      px = -Math.sign(px) * halfBox + (px - Math.sign(px) * halfBox);
      if (Math.abs(px) > halfBox) px = (Math.random() - 0.5) * boxSize;
    }
    if (py > halfBox || py < -halfBox) {
      py = -Math.sign(py) * halfBox + (py - Math.sign(py) * halfBox);
      if (Math.abs(py) > halfBox) py = (Math.random() - 0.5) * boxSize;
    }
    if (pz > halfBox || pz < -halfBox) {
      pz = -Math.sign(pz) * halfBox + (pz - Math.sign(pz) * halfBox);
      if (Math.abs(pz) > halfBox) pz = (Math.random() - 0.5) * boxSize;
    }

    positions[i4] = px;
    positions[i4 + 1] = py;
    positions[i4 + 2] = pz;
    positions[i4 + 3] = energy;

    velocities[i3] = vx;
    velocities[i3 + 1] = vy;
    velocities[i3 + 2] = vz;
  }
};

/**
 * Writes a column-major 4x4 View matrix (camera at eye looking at origin, up = +Y)
 * and Perspective Projection matrix into pre-allocated Float32Arrays.
 */
export const writeCameraMatrices = (
  outView: Float32Array,
  outProj: Float32Array,
  aspect: number,
  camX: number,
  camY: number,
  camZ: number,
  fovDeg: number,
  near = 0.1,
  far = 100,
): void => {
  // LookAt(eye=[camX, camY, camZ], target=[0,0,0], up=[0,1,0])
  const zLen = Math.hypot(camX, camY, camZ) || 1;
  const zx = camX / zLen;
  const zy = camY / zLen;
  const zz = camZ / zLen;

  // xAxis = normalize(cross(up, z)) = normalize(zz, 0, -zx)
  const xLen = Math.hypot(zz, -zx) || 1;
  const xx = zz / xLen;
  const xy = 0;
  const xz = -zx / xLen;

  // yAxis = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  outView[0] = xx;
  outView[1] = yx;
  outView[2] = zx;
  outView[3] = 0;

  outView[4] = xy;
  outView[5] = yy;
  outView[6] = zy;
  outView[7] = 0;

  outView[8] = xz;
  outView[9] = yz;
  outView[10] = zz;
  outView[11] = 0;

  outView[12] = -(xx * camX + xy * camY + xz * camZ);
  outView[13] = -(yx * camX + yy * camY + yz * camZ);
  outView[14] = -(zx * camX + zy * camY + zz * camZ);
  outView[15] = 1;

  // Perspective projection (OpenGL clip space [-1, 1])
  const safeAspect = Math.max(0.1, aspect);
  const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
  const nf = 1 / (near - far);

  outProj.fill(0);
  outProj[0] = f / safeAspect;
  outProj[5] = f;
  outProj[10] = (far + near) * nf;
  outProj[11] = -1;
  outProj[14] = 2 * far * near * nf;
};
