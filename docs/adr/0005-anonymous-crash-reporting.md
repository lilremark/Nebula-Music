# ADR 0005: Opt-in anonymous crash reporting through the main process

- Status: Accepted
- Date: 2026-11-07

## Context

Nebula had no way to learn about crashes on users' machines; error boundaries
only logged to the console. We want crash data for beta first and stable from
3.0.1, without weakening the hardened shell (ADR 0003) or collecting anything
that identifies a user, their server or their library.

Beta and stable share one build (ADR 0004), so the feature cannot be scoped by
build flavor.

## Decision

1. **Sentry, through `@sentry/electron`, in the main process only.** Renderer
   errors are forwarded over the app's own preload bridge
   (`nebula:diagnostics:report`), validated with zod, and captured by the main
   process. The SDK runs with `ipcMode: 0`, so it registers no IPC channels and
   no `sentry-ipc://` protocol, and the CSP is unchanged.
2. **Opt-in.** `crashReports` is `'unset' | 'enabled' | 'disabled'`, starting
   at `'unset'`. A one-time banner asks; nothing is sent until the user picks
   Share. Consent and the install id are writable only through
   `nebula:diagnostics:set-crash-reporting` from the main window; the generic
   `settings:set` channel rejects both keys and `settings:get` hides the id.
3. **Random install id.** A UUID created on opt-in and deleted on opt-out,
   sent as Sentry's `user.id` and nothing else.
4. **Scrub in the app, not only in Sentry.** `beforeSend` runs
   `electron/crashScrub.ts`: home-directory paths, URLs other than `app://`,
   Subsonic auth parameters, API keys and emails are removed, and contexts,
   tags and extras are allowlisted. Sentry's server-side scrubbing and
   IP-address storage settings are a second layer.
5. **No native minidumps, breadcrumbs, sessions, screenshots or tracing.**
   Minidumps contain process memory, which can hold credentials. Native
   crashes are reported as metadata from Electron's `render-process-gone` and
   `child-process-gone` events (process, reason, exit code).
6. **The SDK is a separate, lazily required bundle** (`electron/dist/sentryMain.cjs`).
   Bundled into `main.cjs` it tripled the file a launch must parse; users who
   never opt in never load it. `@sentry/electron` is a devDependency so
   electron-builder does not ship its dependency tree.
7. **One project, environment by version.** Releases are `nebula@<version>`;
   the environment is `beta` for `-beta.N` versions, `stable` otherwise, and
   `development` for unpackaged runs.
8. **The DSN is injected at build time** from the `SENTRY_DSN` secret in the
   release workflow. Local and fork builds have no DSN, so the feature is
   unavailable there and the consent UI is hidden.
9. **Source maps are uploaded and never shipped.** Release builds write maps,
   `scripts/sentrySourcemaps.mjs` injects debug ids, uploads on tags, and
   deletes every map before electron-builder packages the app.
10. **Sentry releases track GitHub releases.** Tag builds create
    `nebula@<version>`; the `sentry-release` job links its commits through
    Sentry's GitHub integration (suspect commits) and finalizes it. Deploys are
    recorded when users can actually receive the build: by the release workflow
    for betas (published automatically), and by `sentry-deploy.yml` when a
    stable draft is published by hand.

## Considered options

- **Renderer SDK (`@sentry/electron/renderer`).** Richer browser context, but
  it needs Sentry's own IPC or protocol and a CSP change, bypassing the typed
  bridge. Rejected.
- **Native minidumps.** The most useful data for native crashes, but they carry
  memory contents we cannot scrub. Revisit only as a separate, explicit opt-in.
- **On by default with opt-out.** Rejected: reporting stays off until the user
  agrees.
- **Self-hosted GlitchTip.** Accepts the same SDK and DSN format; switching
  later is a configuration change.

## Consequences

- Event volume is capped per session (50 events, 20 renderer reports) so a
  crash loop cannot exhaust the quota.
- Opting out mid-session turns `beforeSend` into a drop-all gate; the SDK stays
  loaded until the next launch, when it is not loaded at all.
- Renderer events do not carry debug ids; their stack traces resolve by release
  and the `~/assets/...` URL prefix the maps are uploaded with.
- `docs/privacy.md` and `components/CrashReportsDisclosure.tsx` describe what
  is sent and must change whenever `crashScrub.ts` does.
