# Contributing to Nebula Music

Thank you for contributing to Nebula Music. Contributions may include bug
reports, compatibility findings, documentation improvements, design feedback,
and code changes.

## Before You Start

- Search existing issues and pull requests to avoid duplicate work.
- Open an issue before making a substantial behavioral or architectural change.
- Keep changes focused. Unrelated refactors should be submitted separately.
- Do not publicly report security vulnerabilities. Follow
  [SECURITY.md](./SECURITY.md) instead.

## Development Setup

### Requirements

- Node.js 20.19+ or 22.12+; Node.js 24 LTS is recommended
- npm
- A Subsonic/OpenSubsonic server for live integration testing, or demo mode
- Docker Desktop or Docker Engine when modifying the container setup
- Windows 10/11 when building or testing the Electron desktop app

### Run Locally

```bash
git clone https://github.com/lilremark/Nebula-Music.git
cd Nebula-Music
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Run the Electron desktop app

Nebula's native Windows desktop app (Electron) shares the same renderer. To run it
from source:

```bash
npm run start:electron   # builds the renderer + main process and launches Electron
```

The desktop app adds a custom frameless title bar, a system tray, Windows taskbar
integration (progress, thumbnail transport buttons, media keys), an always-on-top
mini-player, OS-credential-vault storage, and automatic updates from GitHub
Releases. See [README.md](./README.md#desktop-for-windows) for the feature set.

## Making Changes

1. Fork the repository and create a branch from `main`.
2. Use a descriptive branch name such as `fix/stream-recovery` or
   `feat/server-capabilities`.
3. Follow the existing TypeScript, React, and Tailwind patterns.
4. Preserve compatibility with both legacy Subsonic servers and OpenSubsonic
   implementations where possible, and with both the web and Electron desktop
   builds where a change crosses the platform boundary.
5. Update documentation when behavior, configuration, dependencies, or
   deployment instructions change.
6. Keep credentials, server URLs, API keys, personal media metadata, and other
   private data out of commits, screenshots, logs, and test fixtures.

## Validation

Run these checks before opening a pull request:

```bash
npm run typecheck
npm run build
npm run build:electron
npm test
npm audit --audit-level=low
```

`npm run build:electron` compiles the Electron main/preload processes and the
renderer. For Electron changes, also smoke-test the desktop app:

```bash
npm run start:electron
```

For Docker changes, also run:

```bash
docker compose -f docker/docker-compose.yml config
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml down
```

Confirm that the container becomes healthy and that:

- `http://localhost:8080/` returns the application.
- `http://localhost:8080/healthz` returns HTTP 204.

## Releasing a New Version

Version bumps touch multiple places. When releasing (e.g. `2.3.0`), update all of
them together to avoid drift:

- `package.json` and `package-lock.json` (`"version"`)
- `constants.ts` — `APP_VERSION` and the top `CHANGELOG` entry
- `context/StreamDeckBridgeContext.tsx` — `NEBULA_VERSION` (derived from
  `APP_VERSION`, keep in sync)
- `README.md` — version badge, release section, and changelog
- `SECURITY.md` — supported-versions table
- `docker/README.md` — pinned image tag, when a web/Docker release is cut

Build and publish the Windows installer with electron-builder using a `GH_TOKEN`
(or `gh auth token`):

```bash
GH_TOKEN=$(gh auth token) npx electron-builder --win --publish always
```

electron-builder creates a GitHub release tagged `v<version>`, uploads the NSIS
installer, its `.blockmap`, and `latest.yml` (the file electron-updater reads for
automatic updates). A draft release is created automatically; publish it once
you are ready.

## Bug Reports

A useful bug report includes:

- Nebula Music version or commit
- Browser and operating system, or the desktop app variant (web vs. Windows
  Electron build) and Windows version
- Subsonic-compatible server and version
- Clear reproduction steps
- Expected and actual behavior
- Relevant browser console or server errors with sensitive data removed
- For desktop-app issues, the installer version and whether the update channel
  is stable or beta

Do not include passwords, tokens, salts, API keys, private server addresses, or
library metadata that you do not want published.

## Pull Requests

Pull requests should:

- Explain the problem and the chosen solution.
- Reference the related issue when one exists.
- Describe user-visible changes and compatibility considerations.
- Include screenshots for meaningful interface changes.
- Include documentation updates where required.
- Pass the type-check, production build, and audit checks.
- Avoid generated files, unrelated formatting changes, and dependency updates
  unrelated to the proposed change.

By submitting a contribution, you agree that it will be licensed under the
project's [MIT License](./LICENSE.txt).

