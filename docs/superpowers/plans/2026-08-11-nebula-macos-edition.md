# Nebula macOS Edition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Windows-first Electron desktop edition of Nebula Music to macOS as v2.4.0, adding native traffic lights, an app menu, a menu-bar status item, Now Playing/media keys, Notification Center updates, and an unsigned arm64 `.dmg` + `.zip` release.

**Architecture:** Extend the existing single Electron shell with `darwin` platform branches, keeping one codebase and the web build as source of truth. macOS window chrome (`titleBarStyle: 'hiddenInset'`) reuses the existing `-webkit-app-region: drag` header; a new `electron/macMenu.ts` owns the app menu + dock menu; the existing `tray.ts` gains a template image + Notification Center update path; Windows-only `globalShortcut` media keys are gated and the renderer Media Session drives Now Playing; `electron-builder.yml` gains a `mac:` (arm64, unsigned) target.

**Tech Stack:** Electron 43, electron-builder, electron-updater, TypeScript, esbuild, Vite, Tailwind, `sharp` + `node:child_process` `iconutil` for icons.

## Global Constraints

- Keep `npm run dev`, `npm test`, `npm run build` (web) unchanged.
- Windows behavior must not regress; only add the minimal `darwin` branches required.
- Prior to any step: run `npm install` once (fresh clone has no `node_modules`).
- Gate (must pass before each commit): `npm run typecheck` (0 errors), `npm test` (all green), `npm run build` (PASS), `npm run build:electron` (PASS).
- No code comments unless a comment already exists in the edited region.
- Commit style: conventional commits (`feat`, `fix`, `build`, `docs`, `chore`).
- Unsigned build: `mac.identity: null` in electron-builder; no notarization.
- Target arch: arm64 only.

---

### Task 1: Icon assets, mac build config, version bump

**Files:**
- Modify: `scripts/generate-icons.mjs`
- Modify: `electron-builder.yml`
- Modify: `package.json`
- Create (generated): `electron/assets/icon.icns`, `electron/assets/trayTemplate.png`, `electron/assets/trayTemplate@2x.png`
- Test: none (artifact-output verified by `ls`; config by JSON parse)

**Interfaces:**
- Produces: `electron/assets/icon.icns` (app bundle icon), `electron/assets/trayTemplate.png` + `trayTemplate@2x.png` (status-item template images) — consumed by `electron-builder.yml` and `electron/tray.ts`.

- [ ] **Step 1: Rewrite `scripts/generate-icons.mjs`**

Add `os` to the imports and append icns + template generation. Full file:

```js
import sharp from 'sharp';
import toIco from 'png-to-ico';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = path.join(root, 'logo.svg');
const outDir = path.join(root, 'electron', 'assets');

if (!fs.existsSync(svg)) {
  throw new Error(`logo.svg not found at ${svg}`);
}

fs.mkdirSync(outDir, { recursive: true });

// 512x512 PNG (window icon source and app icon fallback)
const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
await fs.promises.writeFile(path.join(outDir, 'icon.png'), png512);

// Multi-size ICO frames for Windows (taskbar, alt-tab, exe resource)
const sizes = [256, 128, 64, 48, 32, 24, 16];
const frames = [];
for (const size of sizes) {
  frames.push(await sharp(svg).resize(size, size).png().toBuffer());
}
const ico = await toIco(frames);
await fs.promises.writeFile(path.join(outDir, 'icon.ico'), ico);

// macOS .icns via the system-iconset directory + built-in `iconutil`.
const iconset = path.join(os.tmpdir(), `nebula-icon-${process.pid}.iconset`);
fs.mkdirSync(iconset, { recursive: true });
const iconSizes = [
  ['icon_16x16.png', 16],
  ['icon_16x16@2x.png', 32],
  ['icon_32x32.png', 32],
  ['icon_32x32@2x.png', 64],
  ['icon_128x128.png', 128],
  ['icon_128x128@2x.png', 256],
  ['icon_256x256.png', 256],
  ['icon_256x256@2x.png', 512],
  ['icon_512x512.png', 512],
  ['icon_512x512@2x.png', 1024],
];
for (const [name, size] of iconSizes) {
  await fs.promises.writeFile(path.join(iconset, name), await sharp(svg).resize(size, size).png().toBuffer());
}
const icnsPath = path.join(outDir, 'icon.icns');
try {
  execFileSync('iconutil', ['-c', 'icns', iconset, '-o', icnsPath], { stdio: 'pipe' });
} catch (error) {
  throw new Error(`Failed to generate ${icnsPath}; iconutil is only available on macOS. ${error instanceof Error ? error.message : ''}`);
} finally {
  fs.rmSync(iconset, { recursive: true, force: true });
}

// macOS menu-bar template image (black + alpha on transparent).
// The Nebula bars mark: a strong central bar flanked by lighter side bars.
const templateSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
  <path d="M4 4v10" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.45"/>
  <path d="M9 1.6v14.8" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  <path d="M14 4v10" stroke="#000" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.45"/>
</svg>`;
await fs.promises.writeFile(
  path.join(outDir, 'trayTemplate.png'),
  await sharp(Buffer.from(templateSvg)).resize(16, 16).png().toBuffer(),
);
await fs.promises.writeFile(
  path.join(outDir, 'trayTemplate@2x.png'),
  await sharp(Buffer.from(templateSvg)).resize(32, 32).png().toBuffer(),
);

console.log(
  `generated electron/assets/icon.png, icon.ico, icon.icns, trayTemplate.png, trayTemplate@2x.png`,
);
```

- [ ] **Step 2: Run the icon script and verify outputs**

Run: `node scripts/generate-icons.mjs`
Then: `ls -la electron/assets/`
Expected: `icon.icns`, `trayTemplate.png`, `trayTemplate@2x.png` exist alongside the existing files.

- [ ] **Step 3: Add the `mac:` block to `electron-builder.yml`**

Append (keep the existing `win:`/`nsis:`/`appx:`/`publish:` blocks unchanged):

```yaml
mac:
  icon: electron/assets/icon.icns
  category: public.app-category.music
  identity: null
  target:
    - target: dmg
      arch:
        - arm64
    - target: zip
      arch:
        - arm64
  artifactName: ${productName}-${version}-${arch}.${ext}
```

`identity: null` forces an unsigned build (no Developer ID lookup). `zip` is required for electron-updater's `latest-mac.yml`.

- [ ] **Step 4: Bump version and add a `dist:mac` script in `package.json`**

Change `"version": "2.3.1"` → `"version": "2.4.0"`. Add after the `dist:win` script line:

```json
    "dist:mac": "node esbuild.config.mjs && vite build && electron-builder --mac --publish never"
```

- [ ] **Step 5: Verify the config files parse**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json ok')"`
Expected: prints `package.json ok`; `git diff -- electron-builder.yml package.json` shows only the added `mac:` block, the version bump, and the `dist:mac` script.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-icons.mjs electron-builder.yml package.json electron/assets/icon.icns electron/assets/trayTemplate.png electron/assets/trayTemplate@2x.png
git commit -m "build(desktop): Add mac arm64 packaging, .icns icon, and tray template icons"
```

---

### Task 2: Window chrome — native traffic lights

**Files:**
- Modify: `electron/main.ts` (`createWindow`, lines ~218-229)
- Modify: `components/layout/TopBar.tsx`
- Test: none (manual visual; gate via typecheck/build)

**Interfaces:**
- Consumes: `process.platform === 'darwin'`; `electron.BrowserWindow` options.
- Produces: main window uses `titleBarStyle: 'hiddenInset'` on darwin; TopBar adds left inset on darwin.

- [ ] **Step 1: Switch the window frame strategy per platform**

In `electron/main.ts`, inside `createWindow`, replace the single `frame` override (currently line 218) with a platform branch:

```ts
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' as const }
      : process.platform === 'win32'
        ? { frame: false }
        : {}),
```

The existing `backgroundColor`, `icon`, and `webPreferences` stay unchanged. On macOS the dock icon comes from the bundle (`.icns`), so the explicit `icon:` is harmless.

- [ ] **Step 2: Add left inset to the TopBar for traffic lights**

In `components/layout/TopBar.tsx`, import `usePlatform` and add a macOS check. Add the import near the top:

```tsx
import { usePlatform } from '../../platform/PlatformContext';
```

Inside the component, before the `return`, add:

```tsx
const platform = usePlatform();
const isMac = platform?.info.os === 'darwin';
```

Change the `<header>` className (line 39) to include a macOS left inset. The literal class `pl-24` must appear so Tailwind emits it:

```tsx
        <header
            className={`relative h-16 flex items-center justify-between px-6 ${isMac ? 'pl-24' : ''} border-b border-neutral-200 dark:border-white/5 sticky top-0 z-30`}
            style={appRegion(isNavOpen ? 'no-drag' : 'drag')}
        >
```

Do not remove the existing `style={appRegion(...)}`; the traffic-light overlay plus the web drag region coexist.

- [ ] **Step 4: Run the build gate**

Run: `npm run typecheck` (0 errors), `npm test`, `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 5: Manual smoke — traffic lights and drag**

Run: `npm run start:electron`
Expected: native red/yellow/green traffic lights overlay the top-left of the dark header; the header (outside buttons) drags the window; the menu button and logo sit right of the traffic lights (no overlap).
Windows path must not regress: confirm `frame: false` is still applied on win32 by reading the branch.

- [ ] **Step 6: Commit**

```bash
git add electron/main.ts components/layout/TopBar.tsx
git commit -m "feat(desktop): Use native macOS traffic lights with a hiddenInset title bar"
```

---

### Task 3: App menu + dock menu + Settings navigation IPC

**Files:**
- Create: `electron/macMenu.ts`
- Modify: `electron/ipc.ts`
- Modify: `electron/preload.ts`
- Modify: `platform/desktopBridge.ts`
- Modify: `platform/types.ts`
- Modify: `platform/desktop.ts`
- Modify: `platform/web.ts`
- Modify: `electron/main.ts`
- Modify: `App.tsx`

**Interfaces:**
- Consumes: `createCommandClient` (`playback/commandClient.ts`), `DesktopCommand`/`DesktopCommandEnvelope` (`playback/desktopProtocol.ts`), `IPC` (`electron/ipc.ts`), `forwardCommand` in `main.ts`.
- Produces: `installMacAppMenu(options)` with `options: { getEpoch: () => number; onCommand: (envelope: DesktopCommandEnvelope) => void; toggleMiniPlayer: () => void; openSettings: () => void }`; IPC channel `IPC.app.openSettings`; preload `bridge.app.onOpenSettings(handler) => () => void`; platform `app.app.onOpenSettings(handler) => () => void`.

- [ ] **Step 1: Add the `openSettings` IPC channel**

In `electron/ipc.ts`, under the `app` group add:

```ts
    openSettings: 'nebula:app:open-settings',
```

- [ ] **Step 2: Create `electron/macMenu.ts`**

```ts
import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron';
import { createCommandClient } from '../playback/commandClient';
import type { DesktopCommand, DesktopCommandEnvelope } from '../playback/desktopProtocol';

interface MacMenuOptions {
  getWindow: () => BrowserWindow | null;
  getEpoch: () => number;
  onCommand: (envelope: DesktopCommandEnvelope) => void;
  toggleMiniPlayer: () => void;
  openSettings: () => void;
}

export const installMacAppMenu = (options: MacMenuOptions): void => {
  const client = createCommandClient('nebula-app-menu', options.getEpoch);
  const send = (command: DesktopCommand) => options.onCommand(client.send(command));

  const appMenu: MenuItemConstructorOptions = {
    label: app.name,
    submenu: [
      { role: 'about', label: `About ${app.name}` },
      { type: 'separator' },
      { label: 'Settings…', accelerator: 'Cmd+,', click: () => options.openSettings() },
      { type: 'separator' },
      { role: 'hide', label: `Hide ${app.name}` },
      { role: 'hideOthers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit', label: `Quit ${app.name}` },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  const playbackMenu: MenuItemConstructorOptions = {
    label: 'Playback',
    submenu: [
      { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
      { label: 'Next', click: () => send({ name: 'next' }) },
      { label: 'Previous', click: () => send({ name: 'previous' }) },
      { type: 'separator' },
      { label: 'Mini Player', click: () => options.toggleMiniPlayer() },
    ],
  };

  const windowMenu: MenuItemConstructorOptions = {
    label: 'Window',
    submenu: [
      { role: 'minimize', label: 'Minimize' },
      { role: 'zoom', label: 'Zoom' },
      { type: 'separator' },
      { role: 'front', label: 'Bring All to Front' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'Toggle Full Screen' },
    ],
  };

  const template: MenuItemConstructorOptions[] = [appMenu, editMenu, playbackMenu, windowMenu];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  const dockMenu = Menu.buildFromTemplate([
    { label: 'Show Nebula', click: () => {
        const win = options.getWindow();
        if (!win) return;
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      } },
    { type: 'separator' },
    { label: 'Play / Pause', click: () => send({ name: 'togglePlayback' }) },
    { label: 'Next', click: () => send({ name: 'next' }) },
    { label: 'Previous', click: () => send({ name: 'previous' }) },
  ]);
  app.dock?.setMenu(dockMenu);
};
```

- [ ] **Step 3: Expose `openSettings` on the preload bridge**

In `electron/preload.ts`, add an `app` group to the `bridge` object (e.g. right before `window`):

```ts
  app: {
    onOpenSettings: (handler: () => void) => {
      const listener = (): void => handler();
      ipcRenderer.on(IPC.app.openSettings, listener);
      return () => {
        ipcRenderer.removeListener(IPC.app.openSettings, listener);
      };
    },
  },
```

- [ ] **Step 4: Extend the renderer-facing types**

In `platform/types.ts`, add an interface and a member:

```ts
export interface PlatformApp {
  /** Subscribes to a "open settings" request from the native app menu. */
  onOpenSettings(handler: () => void): () => void;
}
```

Add to the `Platform` interface (near `miniPlayer`):

```ts
  readonly app: PlatformApp;
```

In `platform/desktopBridge.ts`, add to the `DesktopBridge` interface:

```ts
  app: {
    onOpenSettings(handler: () => void): () => void;
  };
```

- [ ] **Step 5: Implement in desktop and web platforms**

In `platform/desktop.ts`, import nothing new (bridge is typed), add to the returned object (e.g. after `miniPlayer`):

```ts
    app: {
      onOpenSettings: (handler) => bridge.app.onOpenSettings(handler),
    },
```

In `platform/web.ts`, add a no-op and include it:

```ts
const webApp: PlatformApp = { onOpenSettings: () => noopUnsubscribe };
```

Add `PlatformApp` to the type import list at the top, and add `app: webApp,` to the returned object.

- [ ] **Step 6: Wire the menu into `main.ts`**

Add the import:

```ts
import { installMacAppMenu } from './macMenu';
```

Inside `app.whenReady()`, after `mainWindow = createWindow();`, add:

```ts
    if (process.platform === 'darwin') {
      installMacAppMenu({
        getWindow: () => mainWindow,
        getEpoch: () => lastSnapshot?.epoch ?? 0,
        onCommand: forwardCommand,
        toggleMiniPlayer,
        openSettings: () => {
          mainWindow?.show();
          mainWindow?.webContents.send(IPC.app.openSettings);
        },
      });
    }
```

- [ ] **Step 7: Subscribe in the renderer**

In `App.tsx`, import `usePlatform` from `./platform/PlatformContext`. Inside `AppContent`, near the other hooks and before the `if (!credentials && !isDemoMode)` early return, add:

```tsx
  const platform = usePlatform();

  useEffect(() => {
    if (!platform) return;
    return platform.app.onOpenSettings(() => setView('SETTINGS'));
  }, [platform, setView]);
```

- [ ] **Step 8: Run the build gate**

Run: `npm run typecheck` (0 errors), `npm test`, `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 9: Manual smoke — menu + dock menu + Cmd+,**

Run: `npm run start:electron` on this Mac.
Expected:
- App menu in the system menu bar: Nebula (About, Settings…, Hide, Quit), Edit (undo/redo/cut/copy/paste — verify Cmd+C/V work in a text field), Playback (Play/Pause/Next/Previous/Mini Player), Window (Minimize/Zoom/Full Screen).
- Cmd+, opens the Settings view.
- Cmd+Q quits; Cmd+W closes the window (app stays running).
- Right-click the Dock icon → Docker menu shows Show Nebula + playback controls that control a played track.

- [ ] **Step 10: Commit**

```bash
git add electron/macMenu.ts electron/ipc.ts electron/preload.ts platform/desktopBridge.ts platform/types.ts platform/desktop.ts platform/web.ts electron/main.ts App.tsx
git commit -m "feat(desktop): Add native macOS app menu, dock menu, and Settings navigation IPC"
```

---

### Task 4: Menu-bar status item, update notifications, media keys, panel mini-player

**Files:**
- Modify: `electron/tray.ts`
- Modify: `electron/mediaKeys.ts`
- Modify: `electron/main.ts`

**Interfaces:**
- Consumes: `electron.Tray`, `nativeImage`, `Notification`, `settingsStore`, `updater.installAndRestart()`, `showMainWindow`/module window handler.
- Produces: darwin template status item; `showUpdateBalloon(version)` branches win32 balloon vs darwin Notification; `registerMediaKeys` inert off-win32; mini-player `type: 'panel'` on darwin.

- [ ] **Step 1: Refactor `electron/tray.ts` for a module-level window handler**

Change the module state (lines 19-20) to add a window show handler:

```ts
let tray: Tray | null = null;
let updateClickHandler: (() => void) | null = null;
let showWindowHandler: (() => void) | null = null;
```

Inside `createTray`, store the window-shower so `showUpdateBalloon` can reach it, and select the icon by platform. Replace the icon + `setToolTip` block (lines 35-37) and the `tray.on('click', ...)` line (line 65):

```ts
  showWindowHandler = showWindow;

  const templatePath = path.join(__dirname, '..', 'assets', 'trayTemplate.png');
  const isDarwin = process.platform === 'darwin';
  const icon = isDarwin
    ? nativeImage.createFromPath(templatePath)
    : nativeImage.createFromDataURL(TRAY_ICON_PNG);
  if (isDarwin) icon.setTemplateImage(true);
  tray = new Tray(icon);
  tray.setToolTip('Nebula');
```

(Add `import path from 'node:path';` at the top of `electron/tray.ts`.)

- [ ] **Step 2: Make `showUpdateBalloon` platform-aware**

Import `Notification` from electron (`import { BrowserWindow, Menu, Notification, Tray, nativeImage, type MenuItemConstructorOptions } from 'electron';`). Replace the `showUpdateBalloon` function (lines 71-77) and add a fallback:

```ts
export const showUpdateBalloon = (version: string): void => {
  if (!tray) return;
  if (process.platform !== 'win32') {
    if (!Notification.isSupported()) return;
    new Notification({
      title: 'Nebula update ready',
      body: `Version ${version} is downloaded. Click to install.`,
    })
      .on('click', () => {
        updateClickHandler?.();
        showWindowHandler?.();
      })
      .show();
    return;
  }
  tray.displayBalloon({
    title: 'Nebula update ready',
    content: `Version ${version} is downloaded. Click to install.`,
  });
};
```

- [ ] **Step 3: Gate media keys to Windows**

In `electron/mediaKeys.ts`, at the top of `registerMediaKeys`, add an early return:

```ts
export const registerMediaKeys = (options: MediaKeysOptions): void => {
  if (process.platform !== 'win32') return;
  if (client) return;
  // ...existing body unchanged
};
```

- [ ] **Step 4: Guard the media-key call site and panel the mini-player in `main.ts`**

In `main.ts`, the `createMiniPlayerWindow` BrowserWindow options (around lines 287-299) — add a darwin panel type to the options object:

```ts
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
```

For the media-key registration at startup (the block guarded by `if (settingsStore.get('mediaKeysEnabled') === true)`, lines ~563-568), the `registerMediaKeys` gate in Step 3 already makes it inert off-win32, so no extra main.ts change is required there. Leave the call site as-is.

- [ ] **Step 5: Run the build gate**

Run: `npm run typecheck` (0 errors), `npm test`, `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 6: Manual smoke — status item, notifications, Now Playing, mini-player**

Run: `npm run start:electron` on this Mac.
Expected:
- Status item appears in the macOS menu bar; its icon adapts to dark/light menu-bar appearance; it shows the context menu (Show Nebula, Play/Pause, Next, Previous, Mini Player, Quit) and Play/Pause controls a played track.
- Playing a track: Now Playing appears in Control Center (and lock screen); media keys from the keyboard drive playback (via the renderer Media Session — no `globalShortcut`).
- Toggling "Mini Player" from the status item opens a small always-on-top panel that floats above other apps and is absent from Cmd-Tab.
- Closing the window keeps playback running; reopening from the status item or Dock works.
- `showUpdateBalloon('9.9.9')` (temporarily invoked via a dev-only `console` trigger if you want to verify) shows a Notification Center banner; otherwise confirm the branch compiles and note the packaged-build dependency.

- [ ] **Step 7: Commit**

```bash
git add electron/tray.ts electron/mediaKeys.ts electron/main.ts
git commit -m "feat(desktop): macOS menu-bar status item, Notification Center updates, panel mini-player"
```

---

### Task 5: Settings UI adaptation

**Files:**
- Modify: `views/Settings.tsx` (`DesktopSettingsPanel`, lines ~141-207)

**Interfaces:**
- Consumes: `platform.info.os` (`'win32'` / `'darwin'`).
- Produces: renders Taskbar Progress only on win32; Global Media Keys as a static row on darwin; menu-bar copy for close/minimize to tray on darwin.

- [ ] **Step 1: Add a static row component**

Near the existing `ToggleRow` (line ~55), add a non-interactive row for darwin-only informational rows:

```tsx
const StaticRow = ({ label, description }: { label: string; description?: string }) => (
    <div className={`${rowClass}`}>
        <span className="min-w-0">
            <span className="block text-sm font-semibold text-neutral-900 dark:text-white">{label}</span>
            {description && <span className="mt-1 block text-xs leading-relaxed text-neutral-600 dark:text-white/50">{description}</span>}
        </span>
        <span className="shrink-0 rounded-full bg-neutral-200 px-3 py-1 text-xs font-bold text-neutral-600 dark:bg-white/10 dark:text-white/50">On</span>
    </div>
);
```

- [ ] **Step 2: Adapt `DesktopSettingsPanel`**

At the top of the `DesktopSettingsPanel` component body, after `const platform = usePlatform();`, add:

```tsx
    const isWindows = platform?.info.os === 'win32';
    const isMac = platform?.info.os === 'darwin';
```

Within the returned `SettingPanel`, replace the four `ToggleRow`s with platform-aware rendering:

- **Close to Tray** description becomes conditional:
  ```tsx
  description={isMac ? 'Closing the window keeps Nebula running in the menu bar.' : 'Closing the window keeps Nebula running in the system tray.'}
  ```
- **Minimize to Tray** description becomes conditional:
  ```tsx
  description={isMac ? 'Minimizing hides the window to the menu bar instead of the Dock.' : 'Minimizing hides the window to the tray instead of the taskbar.'}
  ```
- **Global Media Keys**: replace the `ToggleRow` with:
  ```tsx
  {isWindows ? (
      <ToggleRow
          label="Global Media Keys"
          description="Control playback with your keyboard's media keys even when Nebula is in the background."
          checked={loaded ? values.mediaKeysEnabled ?? true : true}
          onChange={(v) => setValue('mediaKeysEnabled', v)}
      />
  ) : (
      <StaticRow
          label="Now Playing"
          description="Media keys and Control Center are handled by macOS while music is playing."
      />
  )}
  ```
- **Taskbar Progress**: wrap the existing `ToggleRow` so it only renders on Windows:
  ```tsx
  {isWindows && (
      <ToggleRow
          label="Taskbar Progress"
          description="Show playback progress in the Windows taskbar."
          checked={loaded ? values.taskbarProgressEnabled ?? true : true}
          onChange={(v) => setValue('taskbarProgressEnabled', v)}
      />
  )}
  ```

- [ ] **Step 3: Run the build gate**

Run: `npm run typecheck` (0 errors), `npm test`, `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 4: Manual smoke — Settings panels on macOS**

Run: `npm run start:electron`, open Settings → Desktop Integration.
Expected: no "Taskbar Progress" row; "Global Media Keys" is replaced by a static "Now Playing" row; Close/Minimize descriptions reference the menu bar / Dock; toggles for Close-to-Tray and Minimize-to-Tray persist.

- [ ] **Step 5: Commit**

```bash
git add views/Settings.tsx
git commit -m "feat(desktop): Adapt desktop settings UI for macOS (Now Playing, menu-bar wording)"
```

---

### Task 6: Release build, verification, and docs

**Files:**
- Modify: `README.md`
- Test: artifact output + full manual smoke checklist

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: `release/Nebula-2.4.0-arm64.dmg`, `release/Nebula-2.4.0-arm64.zip`, `release/latest-mac.yml`; documented unsigned-update caveat.

- [ ] **Step 1: Run the full gate**

Run: `npm run typecheck` (0 errors), `npm test` (all green), `npm run build`, `npm run build:electron` — all PASS.

- [ ] **Step 2: Build the arm64 artifacts**

Run: `npm run dist:mac`
Expected: completes without a signing failure (unsigned via `identity: null`), producing in `release/`:
- `Nebula-2.4.0-arm64.dmg`
- `Nebula-2.4.0-arm64.zip`
- `latest-mac.yml`

Verify with: `ls -la release/`

- [ ] **Step 3: Document the macOS edition + unsigned auto-update caveat in `README.md`**

Update the "Desktop for Windows" section heading to cover macOS (e.g. "Desktop App (Windows & macOS)"), add a short macOS subsection listing the native features (traffic lights, app menu, menu-bar status item, Now Playing/media keys, Notification Center updates, `.dmg` installer), and add a note:

> macOS builds ship unsigned. On first launch, right-click the app and choose **Open** (or allow it in System Settings → Privacy & Security) to bypass Gatekeeper. Automatic updates require code signing; the update check, download, and in-app banner work unsigned, but "Restart & Install" may not complete until the app is signed with a Developer ID.

- [ ] **Step 4: Full end-to-end smoke test on this Mac**

Run the development app (`npm run start:electron`) and, using the installed `release/Nebula-2.4.0-arm64.dmg`, walk the checklist from the spec: traffic lights, drag region, app menu (About/Settings Cmd+,/Edit shortcuts/Playback/Window), status item + context menu, Dock menu, Now Playing in Control Center, media keys, Notification update path, floating panel mini-player, close-to-menu-bar behavior, and launch from the installed `.dmg`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs(desktop): Document the macOS edition and unsigned auto-update caveat"
```

- [ ] **Step 6: (Optional) Tag a release candidate**

```bash
git tag -a v2.4.0-rc.1 -m "Nebula macOS edition release candidate 1"
```

---

## Self-Review Notes

- **Spec coverage:** Every `## Changes` subsection maps to a task: §1 packaging → Task 1; §2 window chrome/menu/navigation → Tasks 2-3; §3 status item/media keys/notifications/panel → Task 4; §4 settings + platform surfaces → Tasks 3 (platform `app` surface) and 5; §5 auto-update caveat → Task 6 docs. Error-handling and testing sections are folded into the tasks they belong to.
- **Type consistency:** `installMacAppMenu`, `IPC.app.openSettings`, `bridge.app.onOpenSettings`, `Platform.app.onOpenSettings`, and `PlatformApp` are defined once (Task 3) and referenced only there; `showUpdateBalloon` keeps its `(version: string) => void` signature and is invoked from `main.ts` as today.
- **No placeholders:** every code step contains the full concrete snippet.
- **Task 6 is the only release-gated task** (DBG/`dist:mac` needs all prior tasks). Tasks 1-5 each end with a green gate and an independently observable result.