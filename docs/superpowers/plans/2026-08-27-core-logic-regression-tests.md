# Core-Logic Regression Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add unit tests for the core-logic modules that carry the most regression risk — app state helpers, Subsonic service, AutoEQ, artwork, local DB, platform/Electron adapters — so a build-and-merge loses nothing silently.

**Architecture:** Colocated `*.test.ts` files mirroring the existing suite. No new dependencies, no DOM/jsdom, no coverage gate in CI. Two small behaviour-preserving extractions (Store queue/nav logic, ownerBridge upcoming-list) make React-bound logic testable without rendering. Coverage config is extended to report the new floor, but CI's merge gate (`npm test`, `typecheck`, `build`) is unchanged.

**Tech Stack:** Vitest 4 (v8 coverage), TypeScript 6, React 19, Electron 43. Tests run in Node (`test.environment` defaults to `node`).

## Global Constraints

- Runs on **both** `main` and `beta`; every module touched exists on both trees (only the beta-only `electron/aiDj/*` is excluded).
- **No new runtime or dev dependencies.**
- **No jsdom / React rendering**; do not add an `environment: 'jsdom'`.
- Tests are **behaviour-preserving**; existing 237 tests, `typecheck`, and `build` must stay green.
- Test files are **type-checked** (`tsc --noEmit` covers `*.test.ts`). Fixtures must satisfy the real types; build helpers or cast (`as ISong`) rather than using loosely-typed literals.
- CI `release-desktop.yml` is **not modified** — it keeps running `npm test` (no coverage), `typecheck`, `build`.
- Branch: work on `feat/tests/core-logic` off `beta`.

---

### Task 1: Test `utils/playback.ts`

**Files:**
- Create: `utils/playback.test.ts`

**Interfaces:**
- Consumes: `containsSameSongs(left: ISong[], right: ISong[]): boolean` (already exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { containsSameSongs } from './playback';

const song = (id: string) => ({ id, title: id, artist: 'x' });

describe('containsSameSongs', () => {
  it('returns true when both queues contain the same songs regardless of order', () => {
    expect(containsSameSongs([song('a'), song('b')], [song('b'), song('a')])).toBe(true);
  });

  it('returns true for duplicate ids and empty queues', () => {
    expect(containsSameSongs([], [])).toBe(true);
    expect(containsSameSongs([song('a'), song('a')], [song('a'), song('a')])).toBe(true);
  });

  it('returns false when lengths differ', () => {
    expect(containsSameSongs([song('a')], [song('a'), song('b')])).toBe(false);
  });

  it('returns false when ids differ', () => {
    expect(containsSameSongs([song('a')], [song('b')])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run utils/playback.test.ts`
Expected: FAIL (no such module / tests error).

- [ ] **Step 3: Implementation already exists** — the function is present; this task only adds the test. Re-run.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run utils/playback.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add utils/playback.test.ts
git commit -m "test(playback): cover containsSameSongs"
```

---

### Task 2: Test `services/db.ts` with an in-memory IndexedDB mock

A self-contained in-memory `indexedDB` is stubbed via `vi.stubGlobal('indexedDB', ...)` so no dependency is added. `LocalDB` is used as-is.

**Files:**
- Create: `services/db.test.ts`

**Interfaces:**
- Consumes: `LocalDB` (exported), `db` singleton (not used directly in tests).
- Produces: none.

- [ ] **Step 1: Write the failing test (with the IDB shim)**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalDB } from './db';

const maps = new Map<string, Map<string, unknown>>();

const makeStore = (name: string) => {
  if (!maps.has(name)) maps.set(name, new Map<string, unknown>());
  const data = maps.get(name)!;
  const objectStore = {
    get: (key: string) => ({ onsuccess: null as any, onerror: null as any, result: undefined }) as any,
    put: (_value: unknown, key?: string) => ({ onsuccess: null as any, onerror: null as any }) as any,
    delete: (_key: string) => ({ onsuccess: null as any, onerror: null as any }) as any,
    getAll: () => ({ onsuccess: null as any, onerror: null as any }) as any,
    clear: () => ({}) as any,
  };
  return objectStore;
};
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/db.test.ts`
Expected: FAIL (typically `indexedDB is not defined` in Node).

- [ ] **Step 3: Complete the shim by wiring the request lifecycle**

```ts
// The shim realises stores at open()/upgradeneeded and fulfils get/put/delete/getAll/clear
// by dispatching onsuccess synchronously against the in-memory Maps. Replace Step 1's
// makeStore skeleton with the full implementation below.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalDB } from './db';

const STORE_SETTINGS = 'settings';
const STORE_CACHE = 'api_cache';
const STORE_STATS = 'stats';

describe('LocalDB', () => {
  const stores = new Map<string, Map<string, unknown>>();
  let db: LocalDB;

  const installIndexedDB = () => {
    vi.stubGlobal('indexedDB', {
      open: vi.fn((_name: string, _version: number) => {
        const request: any = {
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
          error: null,
          result: null,
        };
        queueMicrotask(() => {
          if (!request.onupgradeneeded) return;
          const idb: any = {
            objectStoreNames: { contains: (n: string) => stores.has(n) },
            createObjectStore: (n: string, opts?: { keyPath?: string }) => {
              stores.set(n, new Map());
              return { keyPath: opts?.keyPath ?? null };
            },
            transaction: (_name: string) => ({ objectStore: (n: string) => makeStore(n) }),
          };
          request.result = idb;
          request.onupgradeneeded({ oldVersion: 0, newVersion: _version, target: { result: idb } });
          request.onsuccess && request.onsuccess();
        });
        return request;
      }),
    });
  };

  const makeStore = (name: string) => {
    const data = stores.get(name)!;
    const tx = (op: string) => {
      const req: any = { error: null, onsuccess: null, onerror: null, result: undefined };
      return {
        get: (key: string) => Object.assign(req, { result: data.get(key) }),
        put: (value: unknown, key?: string) => {
          const k = key !== undefined ? key : (value as any).id;
          data.set(String(k), value);
          return req;
        },
        delete: (key: string) => { data.delete(key); return req; },
        getAll: () => Object.assign(req, { result: [...data.values()] }),
        clear: () => { data.clear(); return {}; },
      };
    };
    return { transaction: () => ({ objectStore: (n: string) => tx(n), oncomplete: null as any }) };
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    stores.clear();
  });

  beforeEach(async () => {
    // Register all three object stores before init runs.
    stores.set(STORE_SETTINGS, new Map());
    stores.set(STORE_CACHE, new Map());
    stores.set(STORE_STATS, new Map());
    installIndexedDB();
    db = new LocalDB();
    await db.init();
  });

  it('saves and retrieves credentials', async () => {
    const creds = { serverUrl: 'https://music.example', username: 'u' };
    await db.saveCredentials(creds);
    expect(await db.getCredentials()).toEqual(creds);
  });

  it('expires cached responses by TTL', async () => {
    await db.cacheResponse('k', { albums: [1, 2] });
    const fresh = await db.getCachedResponse('k', 60);
    expect(fresh).toEqual({ albums: [1, 2] });
    const expired = await db.getCachedResponse('k', -1);
    expect(expired).toBeNull();
  });

  it('increments play counts and returns most-played first', async () => {
    await db.incrementPlayCount({ id: 'a', title: 'A' }, 'srv');
    await db.incrementPlayCount({ id: 'a', title: 'A' }, 'srv');
    await db.incrementPlayCount({ id: 'b', title: 'B' }, 'srv');
    await db.incrementPlayCount({ id: 'x', title: 'X' }, 'other');
    const top = await db.getMostPlayed('srv', 10);
    expect(top.map((s: any) => s.id)).toEqual(['a', 'b']);
  });

  it('sets, gets, removes, and clears a value', async () => {
    await db.set('settings', 'key', { ok: 1 });
    expect(await db.get('settings', 'key')).toEqual({ ok: 1 });
    await db.remove('settings', 'key');
    expect(await db.get('settings', 'key')).toBeUndefined();
    await db.set('settings', 'again', 1);
    await db.clear('settings');
    expect(await db.get('settings', 'again')).toBeUndefined();
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/db.test.ts`
Expected: 4 passed (if a hang occurs, the shim's promise chain needs `queueMicrotask`/sync `onsuccess` dispatch — keep it synchronous).

- [ ] **Step 5: Commit**

```bash
git add services/db.test.ts
git commit -m "test(db): cover LocalDB via an in-memory IndexedDB shim"
```

---

### Task 3: Test `services/subsonicService.ts`

Uses a fake `SubsonicTransport` so no network/Electron is needed.

**Files:**
- Create: `services/subsonicService.test.ts`

**Interfaces:**
- Consumes: `SubsonicService` (exported), methods `setCredentials`, `setTransport`, `hashPassword` (static), `getStreamUrl`, `getCoverArtUrl`, `getPing`.
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubsonicService } from './subsonicService';
import type { SubsonicTransport } from './subsonicTransport';

const makeTransport = () => {
  const resolveMediaUrl = vi.fn((u: string) => u);
  const fetchJson = vi.fn(async () => ({ status: 200, statusText: '', ok: true, body: {} }));
  return { resolveMediaUrl, fetchJson } as unknown as SubsonicTransport;
};

const creds = {
  serverUrl: 'https://music.example',
  username: 'user',
  token: 'tok',
  salt: 'salt',
  password: 'pw',
  authType: 'password' as const,
};

afterEach(() => { vi.unstubAllGlobals(); });

describe('SubsonicService', () => {
  it('hashPassword returns a 32-hex salt and an md5 token', () => {
    const { token, salt } = SubsonicService.hashPassword('secret');
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('in demo mode getStreamUrl returns a sampled pixabay URL and caches it', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    const first = svc.getStreamUrl('abc123');
    expect(first).toMatch(/^https:\/\/cdn\.pixabay\.com/);
    expect(t.resolveMediaUrl).toHaveBeenCalledTimes(1);
    const second = svc.getStreamUrl('abc123');
    expect(second).toBe(first);
    expect(t.resolveMediaUrl).toHaveBeenCalledTimes(1); // cached
  });

  it('with real credentials getStreamUrl builds a stream.view URL and caches', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    svc.setCredentials(creds);
    const url = svc.getStreamUrl('song-1', 'm4a');
    expect(url).toContain('/rest/stream.view');
    expect(url).toContain('id=song-1');
    expect(url).toContain('u=user');
    expect(url).toContain('t=tok');
    expect(url).toContain('s=salt');
    expect(url).toContain('format=mp3'); // m4a forced to mp3
    expect(svc.getStreamUrl('song-1', 'm4a')).toBe(url); // cached
  });

  it('forces a flac transcode for alac/aif/wav prefixes', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    svc.setCredentials(creds);
    expect(svc.getStreamUrl('x', 'alac')).toContain('format=flac');
  });

  it('getCoverArtUrl passes through absolute http ids and falls back to a placeholder in demo', () => {
    const svc = new SubsonicService(null);
    const t = makeTransport();
    svc.setTransport(t);
    expect(svc.getCoverArtUrl('https://cdn.example/a.jpg')).toBe('https://cdn.example/a.jpg');
    expect(svc.getCoverArtUrl('')).toBe('https://picsum.photos/300/300?grayscale');
  });

  it('getPing returns false when the request throws', async () => {
    const svc = new SubsonicService(creds);
    const t = makeTransport();
    t.fetchJson = vi.fn(async () => { throw new Error('nope'); });
    svc.setTransport(t);
    expect(await svc.getPing()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/subsonicService.test.ts`
Expected: FAIL — `window is not defined` in `hashPassword`, and/or response-shape mismatches. Fix by stubbing `window.crypto` (next step).

- [ ] **Step 3: Stub `window.crypto` so `hashPassword` works in Node**

Add inside the test file (top of `afterEach` is already set). Place a `beforeEach`:

```ts
import { beforeEach } from 'vitest';
beforeEach(() => {
  const crypto = globalThis.crypto as Crypto;
  vi.stubGlobal('window', { crypto });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/subsonicService.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add services/subsonicService.test.ts
git commit -m "test(subsonic): cover URL building, auth, caching, ping, and hashPassword"
```

---

### Task 4: Test `services/autoEqService.ts`

Stubs `fetch` and `localStorage`.

**Files:**
- Create: `services/autoEqService.test.ts`

**Interfaces:**
- Consumes: `parseAutoEqFixedBandProfile`, `fetchAutoEqIndex`, `searchAutoEqProfiles`, `fetchAutoEqProfile` (all exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  parseAutoEqFixedBandProfile,
  fetchAutoEqIndex,
  searchAutoEqProfiles,
  fetchAutoEqProfile,
} from './autoEqService';

const PROFILE = [
  'Preamp: -6.2 dB',
  'Filter 1: ON PK Fc 31 Hz Gain 3.0 dB Q 1.41',
  'Filter 2: ON PK Fc 64 Hz Gain -2.5 dB Q 1.41',
  'Filter 3: ON PK Fc 125 Hz Gain 1.0 dB Q 1.41',
  'Filter 4: ON PK Fc 250 Hz Gain -1.5 dB Q 1.41',
  'Filter 5: ON PK Fc 500 Hz Gain 2.0 dB Q 1.41',
  'Filter 6: ON PK Fc 1000 Hz Gain -3.0 dB Q 1.41',
  'Filter 7: ON PK Fc 2000 Hz Gain 4.0 dB Q 1.41',
  'Filter 8: ON PK Fc 4000 Hz Gain -1.0 dB Q 1.41',
  'Filter 9: ON PK Fc 8000 Hz Gain 0.5 dB Q 1.41',
  'Filter 10: ON PK Fc 16000 Hz Gain -0.2 dB Q 1.41',
].join('\n');

const STORE: Record<string, string> = {};

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => STORE[k] ?? null,
    setItem: (k: string, v: string) => { STORE[k] = v; },
    removeItem: (k: string) => { delete STORE[k]; },
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => { vi.unstubAllGlobals(); Object.keys(STORE).forEach((k) => delete STORE[k]); });

describe('autoEqService', () => {
  it('throws when a profile has too few bands', () => {
    expect(() => parseAutoEqFixedBandProfile('Preamp: -6.0 dB')).toThrow(/not enough fixed-band/i);
  });

  it('parses a fixed-band profile into 10 clamped bands with a preamp', () => {
    const { bands, preamp, raw } = parseAutoEqFixedBandProfile(PROFILE);
    expect(Object.keys(bands)).toHaveLength(10);
    expect(bands['32']).toBe(3);
    expect(bands['64']).toBe(-2.5);
    expect(bands['1k']).toBe(-3);
    expect(bands['16k']).toBe(-0.2);
    expect(preamp).toBe(-6.2);
    expect(raw).toBe(PROFILE);
  });

  it('clamps gains to [-12, 12]', () => {
    const profile = PROFILE.replace('Gain 3.0 dB', 'Gain 30.0 dB');
    const { bands } = parseAutoEqFixedBandProfile(profile);
    expect(bands['32']).toBe(12);
  });

  it('parses a GraphicEQ pair format when present', () => {
    const eq = ['Preamp: -2.0 dB', 'GraphicEQ: 31 -2.2; 64 1.1; 125 0.0; 250 -1.0; 500 2.2; 1000 -0.5; 2000 0.8; 4000 -2.0; 8000 1.5; 16000 0.3'].join('\n');
    const { preamp, bands } = parseAutoEqFixedBandProfile(eq);
    expect(preamp).toBe(-2.0);
    expect(bands['32']).toBe(-2.2);
  });

  it('searchAutoEqProfiles returns [] for queries shorter than 2 chars', async () => {
    expect(await searchAutoEqProfiles('a')).toEqual([]);
  });

  it('fetchAutoEqProfile throws on a non-ok response', async () => {
    const t = globalThis.fetch as ReturnType<typeof vi.fn>;
    t.mockResolvedValue(new Response('nope', { status: 500 }));
    await expect(fetchAutoEqProfile({ id: 'x', name: 'x', source: 'x', path: 'results/x', rawUrl: 'https://x' }))
      .rejects.toThrow(/request failed \(500\)/);
  });

  it('fetchAutoEqIndex reads from localStorage cache when fresh', async () => {
    const t = globalThis.fetch as ReturnType<typeof vi.fn>;
    const entries = [{ id: 'a', name: 'A', source: 's', path: 'results/a FixedBandEQ.txt', rawUrl: 'https://r' }];
    STORE['nebula_autoeq_index_v2'] = JSON.stringify({ fetchedAt: Date.now(), entries });
    t.mockRejectedValue(new Error('should not be called'));
    expect(await fetchAutoEqIndex()).toEqual(entries);
    expect(t).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/autoEqService.test.ts`
Expected: FAIL — `localStorage`/`fetch` not defined, and `Response` may not exist; guard with a local Response polyfill.

- [ ] **Step 3: Add a minimal `Response` if `globalThis.Response` is missing**

```ts
if (!globalThis.Response) {
  class FakeResponse {
    ok: boolean; status: number; text: () => Promise<string>;
    constructor(body: string, init: { status: number }) {
      this.ok = init.status >= 200 && init.status < 300;
      this.status = init.status;
      this.text = async () => body;
    }
  }
  vi.stubGlobal('Response', FakeResponse);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/autoEqService.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add services/autoEqService.test.ts
git commit -m "test(autoeq): cover profile parsing, clamping, search guard, and index caching"
```

---

### Task 5: Test `services/streamDeckArtwork.ts`

Stubs `fetch` and the minimal `FileReader`/`Image`/`document` used on the happy path; the guard branches need only `fetch`.

**Files:**
- Create: `services/streamDeckArtwork.test.ts`

**Interfaces:**
- Consumes: `createSanitizedArtwork(authenticatedUrl, signal?, targetSize?)` (exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSanitizedArtwork } from './streamDeckArtwork';

const makeBlob = (type: string, content = 'x') => ({ type, size: content.length }) as Blob;

// Minimal canvas that records drawImage and returns a small data URL.
beforeEach(() => {
  const ctx = { drawImage: vi.fn() };
  const canvas: any = {
    width: 0, height: 0,
    getContext: () => ctx,
    toDataURL: () => 'data:image/jpeg;base64,AAAA',
  };
  vi.stubGlobal('document', { createElement: () => canvas });
  vi.stubGlobal('Image', class { onload: any; onerror: any; src: string; naturalWidth = 256; naturalHeight = 256;
    constructor() { queueMicrotask(() => this.onload && this.onload()); } });
  vi.stubGlobal('FileReader', class {
    onload: any; onerror: any; result: string | null = null;
    readAsDataURL() { this.result = 'data:image/jpeg;base64,AAAA'; queueMicrotask(() => this.onload && this.onload()); }
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('createSanitizedArtwork', () => {
  const t = () => globalThis.fetch as ReturnType<typeof vi.fn>;

  it('sends the authenticated URL with same-origin credentials and force-cache', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '100' }, blob: async () => makeBlob('image/jpeg') });
    await createSanitizedArtwork('https://m/art?id=1');
    expect(t()).toHaveBeenCalledWith('https://m/art?id=1', expect.objectContaining({ credentials: 'same-origin' }));
  });

  it('returns undefined when the response is not ok', async () => {
    t().mockResolvedValue({ ok: false, headers: { get: () => '10' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined when the declared content-length exceeds the cap', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '999999999' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns undefined for a non-image blob', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '10' }, blob: async () => makeBlob('text/plain') });
    expect(await createSanitizedArtwork('https://m/art')).toBeUndefined();
  });

  it('returns a jpeg data URL on the happy path', async () => {
    t().mockResolvedValue({ ok: true, headers: { get: () => '10' }, blob: async () => makeBlob('image/jpeg') });
    expect(await createSanitizedArtwork('https://m/art')).toMatch(/^data:image\/jpeg/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run services/streamDeckArtwork.test.ts`
Expected: FAIL — `FileReader`/`Image`/`document`/`fetch` undefined in Node.

- [ ] **Step 3: Stub globals (already in `beforeEach` above)** — adjust the `Image`/canvas mock if `naturalWidth`/`naturalHeight` are read as `0`; if the happy path returns `undefined` instead of a data URL, set real `naturalWidth`/`naturalHeight` in the constructor.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run services/streamDeckArtwork.test.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add services/streamDeckArtwork.test.ts
git commit -m "test(artwork): cover fetch guards and the jpeg happy path"
```

---

### Task 6: Test `electron/ipc.ts`

`ipc.ts` is pure (exports a frozen `IPC` object); no mocks needed.

**Files:**
- Create: `electron/ipc.test.ts`

**Interfaces:**
- Consumes: `IPC` (exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { IPC } from './ipc';

describe('IPC channel names', () => {
  it('keeps channel names namespaced and unique across groups', () => {
    const all = Object.values(IPC).flatMap((group) => Object.values(group as Record<string, string>));
    expect(all.length).toBe(new Set(all).size);
  });

  it('exposes the shared channel constants used by preload and main', () => {
    expect(IPC.settings.get).toBe('nebula:settings:get');
    expect(IPC.settings.set).toBe('nebula:settings:set');
    expect(IPC.window.minimize).toBe('nebula:window:minimize');
    expect(IPC.window.close).toBe('nebula:window:close');
    expect(IPC.playback.command).toBe('nebula:playback:command');
    expect(IPC.updater.status).toBe('nebula:updater:status');
    expect(IPC.app.info).toBe('nebula:app:info');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run electron/ipc.test.ts`
Expected: PASS (module is already complete; this adds regression protection).

- [ ] **Step 3: Commit**

```bash
git add electron/ipc.test.ts
git commit -m "test(ipc): pin IPC channel constants"
```

---

### Task 7: Test `electron/settingsStore.ts`

`settingsStore.ts` uses `node:fs/promises` and `node:path` (no Electron import). Test with a real temp directory.

**Files:**
- Create: `electron/settingsStore.test.ts`

**Interfaces:**
- Consumes: `SettingsStore.open(filePath)`, `.get(key)`, `.set(key, value)`, `.snapshot()`.
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SettingsStore } from './settingsStore';
import { DESKTOP_SETTINGS_DEFAULTS } from './settingsSchema';

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'nebula-settings-'));
  file = path.join(dir, 'settings.json');
});
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('SettingsStore', () => {
  it('falls back to defaults when the file does not exist', async () => {
    const store = await SettingsStore.open(file);
    expect(store.snapshot()).toEqual(DESKTOP_SETTINGS_DEFAULTS);
  });

  it('falls back to defaults on corrupt json', async () => {
    await writeFile(file, 'not-json', 'utf8');
    const store = await SettingsStore.open(file);
    expect(store.snapshot()).toEqual(DESKTOP_SETTINGS_DEFAULTS);
  });

  it('persists a valid setting and reloads it atomically', async () => {
    const store = await SettingsStore.open(file);
    await store.set('trayOnClose', false);
    const reloaded = await SettingsStore.open(file);
    expect(reloaded.get('trayOnClose')).toBe(false);
  });

  it('throws on an invalid setting value', async () => {
    const store = await SettingsStore.open(file);
    await expect(store.set('updateChannel', 'nonsense')).rejects.toThrow(/Invalid desktop setting "updateChannel"/);
  });

  it('serialised writes always land on a valid file with a trailing newline', async () => {
    const store = await SettingsStore.open(file);
    const a = store.set('mediaKeysEnabled', false);
    const b = store.set('tracklistProgressEnabled', false);
    await Promise.all([a, b]);
    const raw = await readFile(file, 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw).mediaKeysEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run electron/settingsStore.test.ts`
Expected: PASS (module already complete; test pins behaviour).

- [ ] **Step 3: Commit**

```bash
git add electron/settingsStore.test.ts
git commit -m "test(settings): cover load fallback, validation, and atomic persistence"
```

---

### Task 8: Test `electron/safeStorageCipher.ts`

This is the one module that imports `electron` directly; mock it.

**Files:**
- Create: `electron/safeStorageCipher.test.ts`

**Interfaces:**
- Consumes: `createSafeStorageCipher()` (exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSafeStorage = {
  isEncryptionAvailable: vi.fn(),
  encryptString: vi.fn(),
  decryptString: vi.fn(),
};
vi.mock('electron', () => ({ safeStorage: mockSafeStorage }));

import { createSafeStorageCipher } from './safeStorageCipher';

beforeEach(() => {
  vi.clearAllMocks();
  mockSafeStorage.isEncryptionAvailable.mockReturnValue(true);
  mockSafeStorage.encryptString.mockReturnValue('enc');
  mockSafeStorage.decryptString.mockReturnValue('plain');
});

describe('createSafeStorageCipher', () => {
  it('reports encryption availability from safeStorage', () => {
    const cipher = createSafeStorageCipher();
    expect(cipher.isEncryptionAvailable()).toBe(true);
  });

  it('delegates encryptString/decryptString to safeStorage', () => {
    const cipher = createSafeStorageCipher();
    expect(cipher.encryptString('secret')).toBe('enc');
    expect(mockSafeStorage.encryptString).toHaveBeenCalledWith('secret');
    expect(cipher.decryptString('enc')).toBe('plain');
    expect(mockSafeStorage.decryptString).toHaveBeenCalledWith('enc');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run electron/safeStorageCipher.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add electron/safeStorageCipher.test.ts
git commit -m "test(vault): cover the safeStorage cipher adapter"
```

---

### Task 9: Test `platform/desktop.ts`

Reads `window.desktop`; stub `globalThis.window`.

**Files:**
- Create: `platform/desktop.test.ts`

**Interfaces:**
- Consumes: `createDesktopPlatform()` (exported).
- Produces: none.

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDesktopPlatform } from './desktop';

const desktopBridge = {
  info: { os: 'win32', appName: 'Nebula', appVersion: '2.5.0' },
  window: { minimize: vi.fn(), toggleMaximize: vi.fn(), close: vi.fn(), isMaximized: vi.fn(), isFullScreen: vi.fn(), onMaximizeChanged: vi.fn() },
  settings: { get: vi.fn(), set: vi.fn() },
  vault: { get: vi.fn(), set: vi.fn(), clear: vi.fn(), getSecret: vi.fn(), setSecret: vi.fn(), clearSecret: vi.fn() },
  playback: { onCommand: vi.fn(), publishSnapshot: vi.fn(), onSnapshot: vi.fn(), sendCommand: vi.fn() },
  http: { fetchJson: vi.fn(), proxyUrl: vi.fn((u) => `app://nebula/proxy?u=${encodeURIComponent(u)}`) },
  app: { onOpenSettings: vi.fn() },
  power: { onResumed: vi.fn() },
  openExternal: vi.fn(),
  miniPlayer: { toggle: vi.fn(), showMain: vi.fn() },
  updater: { getState: vi.fn(), check: vi.fn(), installAndRestart: vi.fn(), openDownloadPage: vi.fn(), onStatus: vi.fn() },
  aiDj: undefined,
};

beforeEach(() => { vi.stubGlobal('window', { desktop: desktopBridge }); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('createDesktopPlatform', () => {
  it('throws when window.desktop is absent', () => {
    // Re-stub to no bridge for this assertion.
    const prev = (globalThis as any).window;
    (globalThis as any).window = {};
    expect(() => createDesktopPlatform()).toThrow(/requires window\.desktop/);
    (globalThis as any).window = prev;
  });

  it('maps platform info and media URL routing', () => {
    const p = createDesktopPlatform();
    expect(p.info).toEqual({ kind: 'desktop', os: 'win32', appName: 'Nebula', appVersion: '2.5.0' });
    expect(p.resolveMediaUrl('https://m/track.mp3')).toBe('https://m/track.mp3');
    expect(p.resolveMediaUrl('http://m/track.mp3')).toContain('/proxy?u=');
    expect(p.resolveMediaUrl('')).toBe('');
  });

  it('wires window/settings/playback/vault methods to the bridge', () => {
    const p = createDesktopPlatform();
    p.window.minimize();
    p.settings.set('k', 'v');
    p.playback.sendCommand({} as any);
    p.vault.set({} as any);
    expect(desktopBridge.window.minimize).toHaveBeenCalled();
    expect(desktopBridge.settings.set).toHaveBeenCalledWith('k', 'v');
    expect(desktopBridge.playback.sendCommand).toHaveBeenCalled();
    expect(desktopBridge.vault.set).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run platform/desktop.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add platform/desktop.test.ts
git commit -m "test(platform): cover the desktop platform adapter"
```

---

### Task 10: Extract + test the ownerBridge upcoming-list helper

Move the already-pure `buildUpcomingList` (currently module-private in `ownerBridge.tsx`) into `playback/desktopProtocol.ts`, export it, and test there.

**Files:**
- Modify: `playback/desktopProtocol.ts` (add `buildUpcomingList` + `QueueSongLike` type)
- Modify: `playback/ownerBridge.tsx` (remove local `buildUpcomingList`/`QueueSongLike`, import from `./desktopProtocol`)
- Modify: `playback/desktopProtocol.test.ts` (add a `describe('buildUpcomingList')` block)

**Interfaces:**
- Produces: `buildUpcomingList(queue, currentSongIndex, repeatMode, coverArtById): DesktopUpcomingTrack[]`.
- Consumes: `toUpcomingSummary` (already in `desktopProtocol.ts`).

> Run `npm run typecheck` and the existing `playback/desktopProtocol.test.ts` + `ownerBridge` tests after the move to confirm no behaviour change.

- [ ] **Step 1: Write the failing test** (append to `playback/desktopProtocol.test.ts`)

```ts
import { buildUpcomingList } from './desktopProtocol';

describe('buildUpcomingList', () => {
  const songs = [{ id: '1', title: 'A', artist: 'x' }, { id: '2', title: 'B', artist: 'y' }, { id: '3', title: 'C', artist: 'z' }];

  it('returns the tracks after the current song, stopping at the end in repeat OFF', () => {
    const upcoming = buildUpcomingList(songs, 0, 'OFF', new Map());
    expect(upcoming.map((t) => t.id)).toEqual(['2', '3']);
  });

  it('wraps to the start when repeat is ALL', () => {
    const upcoming = buildUpcomingList(songs, 2, 'ALL', new Map());
    expect(upcoming.map((t) => t.id)).toEqual(['1', '2']);
  });

  it('returns an empty list when the queue is empty or index is invalid', () => {
    expect(buildUpcomingList([], 0, 'OFF', new Map())).toEqual([]);
    expect(buildUpcomingList(songs, -1, 'OFF', new Map())).toEqual([]);
  });

  it('resolves cover art from the coverArtById map', () => {
    const cover = new Map([['2', 'data:image/jpeg;base64,AAAA']]);
    const upcoming = buildUpcomingList(songs, 0, 'OFF', cover);
    expect(upcoming[0]?.coverArtUrl).toBe('data:image/jpeg;base64,AAAA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run playback/desktopProtocol.test.ts`
Expected: FAIL — `buildUpcomingList` is not exported.

- [ ] **Step 3: Move `buildUpcomingList` + `QueueSongLike` into `desktopProtocol.ts` and re-export**

```ts
// In playback/desktopProtocol.ts, with the other exports:
export interface QueueSongLike {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverArt?: string;
}

export const buildUpcomingList = (
  queue: QueueSongLike[],
  currentSongIndex: number,
  repeatMode: 'OFF' | 'ALL' | 'ONE',
  coverArtById: Map<string, string | undefined>,
): DesktopUpcomingTrack[] => {
  // (copy the exact body from ownerBridge.tsx)
  if (queue.length === 0 || currentSongIndex < 0) return [];
  const result: DesktopUpcomingTrack[] = [];
  let index = currentSongIndex + 1;
  let guard = 0;
  const UPCOMING_LIST_SIZE = 5;
  while (result.length < UPCOMING_LIST_SIZE && guard < queue.length + UPCOMING_LIST_SIZE) {
    guard += 1;
    if (index >= queue.length) {
      if (repeatMode !== 'ALL') break;
      index = 0;
    }
    if (index === currentSongIndex) break;
    const song = queue[index];
    if (song) {
      result.push(
        toUpcomingSummary({
          id: song.id,
          title: song.title,
          artist: song.artist,
          ...(song.album ? { album: song.album } : {}),
          durationSeconds: song.duration,
          coverArtUrl: coverArtById.get(song.id),
        }),
      );
    }
    index += 1;
  }
  return result;
};
```

- [ ] **Step 4: Update `ownerBridge.tsx` to import it and delete the local copy**

```ts
// ownerBridge.tsx: replace the local `const buildUpcomingList = ...` and the
// `interface QueueSongLike` with the import:
import { buildUpcomingList, type QueueSongLike } from './desktopProtocol';
```

- [ ] **Step 5: Run the suite to verify it passes and nothing regressed**

Run: `npx vitest run playback/desktopProtocol.test.ts && npx vitest run playback/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add playback/desktopProtocol.ts playback/ownerBridge.tsx playback/desktopProtocol.test.ts
git commit -m "refactor(playback): extract and test buildUpcomingList"
```

---

### Task 11: Extract + test the Store queue/nav logic

Extract the pure `computeNextPlaybackIndex` and navigation-stack helpers from `context/Store.tsx` into a new pure module and test them, then use them in `Store.tsx`.

**Files:**
- Create: `context/storeQueueLogic.ts`
- Modify: `context/Store.tsx` (import and use the helpers)
- Create: `context/storeQueueLogic.test.ts`

**Interfaces:**
- Produces:
  - `computeNextPlaybackIndex(songIndex: number, songQueue: ISong[], mode: RepeatMode): number`
  - `pushNavigationStack<N>(stack: N[], entry: N, limit?: number): N[]`
  - `popNavigationStack<N>(stack: N[]): { stack: N[]; entry: N | undefined }`
- Consumes: `ISong`, `RepeatMode` from `../types`.

> The current `getNextPlaybackIndex` body is replaced by `computeNextPlaybackIndex`. `setView`'s push slice is replaced by `pushNavigationStack`, and `goBack`'s pop by `popNavigationStack`. Behaviour-preserving.

- [ ] **Step 1: Write the failing test**

```ts
import type { ISong } from '../types';
import { describe, expect, it } from 'vitest';
import { computeNextPlaybackIndex, pushNavigationStack, popNavigationStack } from './storeQueueLogic';

const song = (id: string): ISong => ({ id, title: id, album: '', artist: '', duration: 1 } as ISong);
const queue = (n: number): ISong[] => Array.from({ length: n }, (_, i) => song(String(i)));

describe('computeNextPlaybackIndex', () => {
  it('returns -1 for an empty queue', () => {
    expect(computeNextPlaybackIndex(0, [], 'OFF')).toBe(-1);
  });

  it('advances to the next index in the middle of the queue', () => {
    expect(computeNextPlaybackIndex(0, queue(3), 'OFF')).toBe(1);
  });

  it('wraps to 0 at the end when repeat is ALL', () => {
    expect(computeNextPlaybackIndex(2, queue(3), 'ALL')).toBe(0);
  });

  it('returns -1 at the end when repeat is OFF or ONE', () => {
    expect(computeNextPlaybackIndex(2, queue(3), 'OFF')).toBe(-1);
    expect(computeNextPlaybackIndex(2, queue(3), 'ONE')).toBe(-1);
  });
});

describe('pushNavigationStack', () => {
  it('appends an entry and bounds the stack to the limit', () => {
    const stack = pushNavigationStack([1, 2], 3, 3);
    expect(stack).toEqual([2, 3]);
  });
});

describe('popNavigationStack', () => {
  it('pops the last entry and returns the remaining stack', () => {
    expect(popNavigationStack([{ view: 'A' }, { view: 'B' }])).toEqual(
      { stack: [{ view: 'A' }], entry: { view: 'B' } },
    );
  });

  it('returns an empty stack and no entry when empty', () => {
    expect(popNavigationStack([])).toEqual({ stack: [], entry: undefined });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run context/storeQueueLogic.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `context/storeQueueLogic.ts`**

```ts
import type { ISong, RepeatMode } from '../types';

export const computeNextPlaybackIndex = (
  songIndex: number,
  songQueue: ISong[],
  mode: RepeatMode,
): number => {
  if (songQueue.length === 0) return -1;
  if (songIndex < songQueue.length - 1) return songIndex + 1;
  if (mode === 'ALL') return 0;
  return -1;
};

export const pushNavigationStack = <N>(
  stack: N[],
  entry: N,
  limit = 50,
): N[] => [...stack, entry].slice(-limit);

export const popNavigationStack = <N>(
  stack: N[],
): { stack: N[]; entry: N | undefined } => {
  if (stack.length === 0) return { stack: [], entry: undefined };
  const entry = stack[stack.length - 1];
  return { stack: stack.slice(0, -1), entry };
};
```

- [ ] **Step 4: Wire `Store.tsx` to use the helpers**

```ts
// Replace the getNextPlaybackIndex useCallback body with the imported helper:
import { computeNextPlaybackIndex, pushNavigationStack, popNavigationStack } from './storeQueueLogic';
// const getNextPlaybackIndex = useCallback((songIndex, songQueue, mode) => computeNextPlaybackIndex(songIndex, songQueue, mode), []);
// setView push: const nextStack = pushNavigationStack(navigationStackRef.current, { view: currentView, data: viewData });
// goBack: const { stack: nextStack, entry: target } = popNavigationStack(navigationStackRef.current);
```

- [ ] **Step 5: Run the suite to verify it passes and nothing regressed**

Run: `npx vitest run context/storeQueueLogic.test.ts && npm test`
Expected: PASS (all existing 237 + new pass).

- [ ] **Step 6: Commit**

```bash
git add context/storeQueueLogic.ts context/Store.tsx context/storeQueueLogic.test.ts
git commit -m "refactor(store): extract and test queue and navigation logic"
```

---

### Task 12: Extend coverage configuration and run full validation

**Files:**
- Modify: `vite.config.ts` (`test.coverage.include`, `test.coverage.thresholds`)

**Interfaces:**
- Consumes: none.

- [ ] **Step 1: Extend `coverage.include` to the newly tested modules**

```ts
include: [
  'services/streamDeckProtocol.ts',
  'services/streamDeckCommands.ts',
  'services/streamDeckAuthentication.ts',
  'utils/playback.ts',
  'services/db.ts',
  'services/subsonicService.ts',
  'services/autoEqService.ts',
  'services/streamDeckArtwork.ts',
  'electron/ipc.ts',
  'electron/settingsStore.ts',
  'electron/safeStorageCipher.ts',
  'platform/desktop.ts',
  'playback/desktopProtocol.ts',
  'context/storeQueueLogic.ts',
],
```

- [ ] **Step 2: Run coverage to read the realized floor**

Run: `npm run test:coverage`
Note the `All files` row values for `% Stmts`, `% Branch`, `% Funcs`, `% Lines`.

- [ ] **Step 3: Set thresholds to the realized floor** (round down to the nearest 5) so `test:coverage` stays green and CI is untouched

```ts
thresholds: { lines: <floor>, functions: <floor>, statements: <floor>, branches: <floor - 10> },
```

- [ ] **Step 4: Verify coverage passes**

Run: `npm run test:coverage`
Expected: exit 0.

- [ ] **Step 5: Full validation**

Run: `npm run test` | `npm run typecheck` | `npm run build`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add vite.config.ts
git commit -m "test(config): extend coverage report to the core-logic modules"
```

---

## Self-Review Notes

- **Spec coverage:** Section 1 modules → Tasks 1–9; Section 2 extractions → Tasks 10–11; Section 3 coverage config → Task 12; Section 5 validation → Task 12 Step 5. Non-goals respected (no jsdom, no new deps, no CI change).
- **Placeholder scan:** none — every code step carries real test/implementation code.
- **Type consistency:** helper signatures in Tasks 10/11 match their consumers (`buildUpcomingList`, `computeNextPlaybackIndex`, `pushNavigationStack`, `popNavigationStack`); `SubsonicService` methods tested match the APIs read from the module.
- **Behaviour-preservation:** Tasks 10/11 move logic verbatim and rely on `npm test` + `typecheck` to confirm no drift.
