# ADR 0004: Beta channel via `allowPrerelease`, not a separate build

- Status: Accepted
- Date: 2026-08-20

## Context

Nebula ships a "Beta" update channel toggle in Settings. The question was how
to model it. Two options presented themselves: (a) treat beta as a flag that
makes the updater accept GitHub **prerelease** releases, or (b) build a
separate beta artifact with its own appId/channel filename and delivery
pipeline.

## Decision

Beta is a runtime preference that toggles `electron-updater`'s
`allowPrerelease` (`electron/updater.ts:113`). The `channel` stays at its
default (`latest.yml`); the stable/beta toggle maps to whether GitHub
prerelease releases are allowed, never to a channel filename. Pre-release
versions use semver prerelease tags (`2.5.0-beta.1`), and the release
workflow publishes any `*-beta.*` tag as a **published** GitHub Prerelease
(drafts are invisible to the updater and would silently break delivery).

There is no separate beta appId, signing identity, installer name, or channel
file. Beta and stable share the same build and artifacts.

## Considered options

- **Separate beta channel file** (e.g. `beta.yml`, a distinct `channel`). The
  GitHub provider in electron-updater 6.8.9 only ever writes `latest.yml`, and
  its channel-from-version logic applies only to the generic provider. Adding a
  beta channel filename would require custom publish logic for no user-visible
  benefit.
- **Separate beta appId / build flavor.** This would let beta and stable
  coexist as distinct installed apps, but it doubles build/signing/artifact
  complexity and is far more than the toggle implies.

## Consequences

- Beta is delivered by publishing GitHub **prerelease** releases from the
  `beta` branch; nothing else in the build changes.
- A beta release must be **published**, never left as a draft, or beta users
  silently get "no update".
- On the 6.8.9 GitHub provider, a beta user with a non-prerelease version
  installed resolves the first entry in the Atom feed (ordered by publish
  time, not semver); this is a known upstream limitation fixed in 7.0.0-alpha.5+.
- Because beta and stable share an appId, a user can only be on one channel at
  a time; switching the toggle moves the installed build between channels.
