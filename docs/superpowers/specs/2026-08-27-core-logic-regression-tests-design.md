# Core-Logic Regression Tests Design

## Problem

The app ships with a passing Vitest suite (28 files, 237 tests) that CI runs via
`npm test`, but coverage is only enforced on the three Stream Deck modules
(`services/streamDeckProtocol|Commands|Authentication.ts`). Large, high-regression
areas of the music player have no tests at all: the app state in
`context/Store.tsx` (2,263 lines), `services/subsonicService.ts` (778 lines),
`services/autoEqService.ts`, service/data adapters, and the React-player logic in
`playback/ownerBridge.tsx`. A change to those modules can silently break the queue,
repeat/shuffle, playback, or API glue without any test failing on build or merge.

## Goal

Add unit tests for the core-logic modules that carry the most regression risk, so a
build-and-merge loses nothing silently. Tests are added **without changing behaviour**
and without overhauling the test infrastructure: no new dependencies, no DOM/jsdom, no
coverage gate in CI. The existing 237 tests, `typecheck`, and `build` stay green.

## Decisions

- **Approach selected**: incremental per-module unit tests, colocated `.test.ts`
  files, mirroring the existing convention in `services/subsonicTransport.test.ts`
  and the Electron/Stream Deck tests.
- **Reach**: core logic only — no React component/view rendering.
- **Enforcement**: tests only. Coverage is an **informational floor**; CI's merge gate
  stays exactly as-is (`npm test`, `typecheck`, `build`). Coverage thresholds are
  extended so `npm run test:coverage` reports a meaningful floor, but never blocks.
- **Branches**: the same change applies to both `main` and `beta`. Every module
  touched exists on both trees; only the beta-only AI DJ module (`electron/aiDj/*`,
  already tested) is excluded. Origin: `feat/tests/core-logic` off `beta`; landed on
  both branches (two PRs / mirror), reconciling any drift in `Store.tsx` /
  `ownerBridge.tsx` if `beta` diverged from `main`.

## Scope

### 1. Direct unit tests (colocated `.test.ts`)

| Module | Behaviour covered |
|---|---|
| `utils/playback.ts` | `containsSameSongs` — equality, ordering-insensitivity, length mismatch |
| `services/subsonicService.ts` | URL building, apiKey/password auth, response mapping, stream/cover-art caching, ping, via injected transport (`setTransport`); `hashPassword` (stubbed `window.crypto`) |
| `services/autoEqService.ts` | `parseAutoEqFixedBandProfile` parser; profile index search/fetch (stubbed fetch) |
| `services/streamDeckArtwork.ts` | artwork → data-URL conversion |
| `services/db.ts` | `LocalDB` read/write/delete via an in-memory IndexedDB stub |
| `electron/safeStorageCipher.ts` | cipher-adapter contract (mock `electron`) |
| `electron/ipc.ts` | handler registration + argument piping (mock `electron`) |
| `electron/settingsStore.ts` | settings read/write/persist (mock `electron` + fs) |
| `platform/desktop.ts` | platform fetch/router adapters (mock `electron`) |

### 2. Extract-helper refactor (no behaviour change)

For the two React-bound giants, extract pure state-transition logic into small
exported helpers (no rendering), then test those helpers and wire them back into the
original call sites:

- `context/Store.tsx` → e.g. `context/storeQueueLogic.ts`: queue next/prev index,
  repeat/shuffle transitions, navigation-stack push/pop.
- `playback/ownerBridge.tsx` → pure media-session / state-derivation helpers.

**Constraint**: behaviour-preserving. Verified by the existing 237 tests, `typecheck`,
and `build` all remaining green after the refactor.

### 3. Coverage configuration (informational)

- Extend `test.coverage.include` in `vite.config.ts` to list the modules in scope
  1 and 2.
- Keep global thresholds at the repo's existing defaults (lines/functions/statements
  80, branches 70), tuned so `npm run test:coverage` passes with the new set.
- **CI unchanged**: `release-desktop.yml` still runs `npm test` (no coverage),
  `typecheck`, and `build`. Coverage never blocks a merge — only a failing test does.

## Conventions

- Colocate `*.test.ts` next to the module under test.
- `import type` where possible; use `describe/it/expect` from `vitest`.
- `vi.mock('electron')`, `vi.stubGlobal` + `vi.unstubAllGlobals()` in `afterEach` —
  the patterns already used across the existing suite.
- No new runtime or dev dependencies; no jsdom environment.

## Validation

- `npm run test` — all existing + new tests pass.
- `npm run typecheck` — no type errors.
- `npm run build` — production build succeeds.
- `npm run test:coverage` — reports the extended informational floor at/above
  threshold.

## Non-goals

- No React component/view rendering tests.
- No E2E or UI automation.
- No hard coverage gate in CI.
- No refactor of module boundaries beyond the two extract-helper seams above.
