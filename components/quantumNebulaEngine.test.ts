import { describe, expect, it } from 'vitest';
import {
  QUANTUM_NEBULA_CONFIG,
  createNebulaState,
  hslToRgb,
  projectPointerToWorld,
  recolorNebulaState,
  resolveNebulaPalette,
  stepNebulaSimulation,
  writeCameraMatrices,
  type NebulaInteraction,
  type QuantumNebulaConfig,
} from './quantumNebulaEngine';

const TEST_CONFIG: QuantumNebulaConfig = {
  ...QUANTUM_NEBULA_CONFIG,
  particleCount: 256,
  prewarmSteps: 6,
};

const baseInteraction = (overrides: Partial<NebulaInteraction> = {}): NebulaInteraction => ({
  pointerX: 0,
  pointerY: 0,
  pointerVelX: 0,
  pointerVelY: 0,
  active: false,
  pressed: false,
  aspect: 1.2,
  pulseX: 0,
  pulseY: 0,
  pulseRadius: 0,
  pulseStrength: 0,
  ...overrides,
});

describe('quantumNebulaEngine', () => {
  it('initializes finite pre-warmed particles within the bounding volume', () => {
    const palette = resolveNebulaPalette(null);
    const state = createNebulaState(palette, TEST_CONFIG, 123);
    const halfBox = TEST_CONFIG.boxSize * 0.5;

    expect(state.count).toBe(TEST_CONFIG.particleCount);
    expect(state.positions.length).toBe(TEST_CONFIG.particleCount * 4);
    expect(state.velocities.length).toBe(TEST_CONFIG.particleCount * 3);
    expect(state.colors.length).toBe(TEST_CONFIG.particleCount * 3);

    for (let i = 0; i < state.count; i++) {
      const i4 = i * 4;
      expect(Number.isFinite(state.positions[i4])).toBe(true);
      expect(Number.isFinite(state.positions[i4 + 1])).toBe(true);
      expect(Number.isFinite(state.positions[i4 + 2])).toBe(true);
      expect(Math.abs(state.positions[i4])).toBeLessThanOrEqual(halfBox + 1e-4);
      expect(Math.abs(state.positions[i4 + 1])).toBeLessThanOrEqual(halfBox + 1e-4);
      expect(Math.abs(state.positions[i4 + 2])).toBeLessThanOrEqual(halfBox + 1e-4);
      expect(state.positions[i4 + 3]).toBe(0);
    }
  });

  it('repels nearby particles and raises energy on pointer hover', () => {
    const palette = resolveNebulaPalette(null);
    const state = createNebulaState(palette, { ...TEST_CONFIG, particleCount: 1, prewarmSteps: 0 }, 1);
    // Place particle right beside the origin (0.5, 0, 0) with zero initial velocity
    state.positions[0] = 0.5;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = 0;
    state.velocities.fill(0);

    stepNebulaSimulation(
      state,
      1 / 60,
      0,
      baseInteraction({ active: true, pressed: false, pointerX: 0, pointerY: 0 }),
      TEST_CONFIG,
    );

    // Repulsion pushes +X outward from origin and energizes the particle
    expect(state.positions[0]).toBeGreaterThan(0.5);
    expect(state.positions[3]).toBeGreaterThan(0);
  });

  it('pulls and swirls particles into a vortex while pointer is held down', () => {
    const palette = resolveNebulaPalette(null);
    const state = createNebulaState(palette, { ...TEST_CONFIG, particleCount: 1, prewarmSteps: 0 }, 1);
    state.positions[0] = 1.2;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = 0;
    state.velocities.fill(0);

    stepNebulaSimulation(
      state,
      1 / 60,
      0,
      baseInteraction({ active: true, pressed: true, pointerX: 0, pointerY: 0 }),
      TEST_CONFIG,
    );

    // Attracted inward (-X) and swirled tangentially (+Y) around cursor
    expect(state.positions[0]).toBeLessThan(1.2);
    expect(state.velocities[1]).toBeGreaterThan(0);
    expect(state.positions[3]).toBeGreaterThan(0);
  });

  it('applies radial shockwave impulse along the expanding pulse ring', () => {
    const palette = resolveNebulaPalette(null);
    const state = createNebulaState(palette, { ...TEST_CONFIG, particleCount: 1, prewarmSteps: 0 }, 1);
    state.positions[0] = 1.0;
    state.positions[1] = 0;
    state.positions[2] = 0;
    state.positions[3] = 0;
    state.velocities.fill(0);

    stepNebulaSimulation(
      state,
      1 / 60,
      0,
      baseInteraction({
        active: false,
        pulseX: 0,
        pulseY: 0,
        pulseRadius: 1.0,
        pulseStrength: 1.0,
      }),
      TEST_CONFIG,
    );

    expect(state.velocities[0]).toBeGreaterThan(0.05);
    expect(state.positions[3]).toBeGreaterThan(0.3);
  });

  it('derives particle palettes from the active theme primary color', () => {
    // Fallback when --color-primary is unset or uninitialized (0, 0, 0) uses defaultAccent (#5368d8)
    const fallback = resolveNebulaPalette(null, [0, 0, 0]);
    expect(fallback.baseHue).toBeGreaterThan(220);
    expect(fallback.baseHue).toBeLessThan(240);

    // Custom primary color on default theme (e.g. emerald green #10b981 -> [16, 185, 129])
    const emerald = resolveNebulaPalette('default', [16, 185, 129]);
    expect(emerald.baseHue).toBeGreaterThan(150);
    expect(emerald.baseHue).toBeLessThan(170);

    const mono = resolveNebulaPalette('ascii-mono', [232, 232, 232]);
    expect(mono.saturation).toBeLessThan(0.1);

    const rose = resolveNebulaPalette('rose', [240, 122, 155]);
    expect(rose.baseHue).toBeGreaterThan(320);

    const state = createNebulaState(emerald, TEST_CONFIG, 7);
    const beforeR = state.colors[0];
    recolorNebulaState(state, rose, 7);
    expect(state.colors[0]).not.toBeCloseTo(beforeR, 2);

    const [r, g, b] = hslToRgb(200, 1, 0.5);
    expect(b).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(r);
  });

  it('projects NDC pointer coordinates onto the z=0 plane consistently with camera matrices', () => {
    const aspect = 1.6;
    const camZ = 5;
    const fov = 75;
    const view = new Float32Array(16);
    const proj = new Float32Array(16);
    writeCameraMatrices(view, proj, aspect, 0, 0, camZ, fov);

    const [wx, wy] = projectPointerToWorld(0.5, -0.25, aspect, camZ, fov);
    // Transform (wx, wy, 0, 1) through view then proj
    const vx = view[0] * wx + view[4] * wy + view[12];
    const vy = view[1] * wx + view[5] * wy + view[13];
    const vz = view[2] * wx + view[6] * wy + view[14];
    const clipW = -vz;
    const ndcX = (proj[0] * vx) / clipW;
    const ndcY = (proj[5] * vy) / clipW;

    expect(ndcX).toBeCloseTo(0.5, 4);
    expect(ndcY).toBeCloseTo(-0.25, 4);
  });
});
