# Releasing Nebula

Every release ships on four targets from one tag: Windows x64, macOS Apple
Silicon, the web bundle and the Docker image. The release notes are written once
and shown in two places: the GitHub release and the in-app **What's New** dialog.

For how the stable and beta channels work, see [beta.md](beta.md).

## Release notes

Write the notes in `docs/release/v<version>.md`, for example
`docs/release/v3.0.2-beta.1.md`. The file is required: `npm test`, the release
workflow and `node scripts/releaseNotes.mjs check` all fail without a valid one.

```markdown
---
version: 3.0.2-beta.1
date: 2026-11-06
title: Faster, Lighter Desktop App
---

One short paragraph on what this release is about. Shown in the app and on GitHub.

## Features

- Add saved queues that survive restarts.

## Performance

- Pause animations while the window is in the tray.
  - GitHub-only detail goes in indented sub-bullets.

## Bug fixes

- Fix the mini-player losing its position after sleep.

## Notes

Optional, GitHub only: platform caveats, upgrade steps, known issues.
```

### Rules

- **Frontmatter:** `version` must match `package.json`, `date` is `YYYY-MM-DD`
  (the tag date), and `title` is a short name for the release in title case.
- **Sections:** use only `## Features`, `## Performance`, `## Bug fixes` and
  `## Notes`, in that order. Leave out a category with nothing in it, but
  include at least one.
- **Bullets:** each change is a `- ` bullet. Its text is what the app shows. A
  bullet may wrap onto indented lines. Indented sub-bullets add detail that
  appears only on GitHub.
- **Notes** is free-form Markdown and appears only on GitHub. Don't repeat the
  unsigned-build and beta-channel caveats; the workflow adds those.

### Choosing a category

| Category | Use it when | Example |
| --- | --- | --- |
| Features | Users can do something new, or an existing feature behaves differently by design. | "Add ReplayGain with Track and Album modes." |
| Performance | Nebula uses less CPU, memory, disk, network or startup time, with no change in behavior. | "Close the mini-player instead of hiding it, freeing its memory." |
| Bug fixes | Something didn't work as intended and now does. | "Fix playback on plain-HTTP Docker addresses." |

When a change fits two categories, pick the one users notice first. Dependency
updates go under Bug fixes when they fix a vulnerability or a defect; otherwise
mention them in Notes.

### Writing the bullets

- Write for listeners, not developers: say what changed for them, not which
  module changed.
- Start with a verb in the present tense ("Add", "Fix", "Show"), or describe the
  result ("Nebula does almost no work while hidden in the tray").
- One change per bullet, one or two sentences. Name the platform when a change
  is limited to one ("On Windows, ...").
- State measured numbers only when they were measured, and say how ("in our
  tests").

Pull requests should carry the matching label (`enhancement`, `performance` or
`bug`). GitHub groups its generated pull-request list by those labels
(`.github/release.yml`).

## Cutting a release

1. **Merge** the work into `beta` (pre-releases) or `main` (stable).
2. **Bump the version** in `package.json`, both `version` fields in
   `package-lock.json`, and `APP_VERSION` in `constants.ts`.
3. **Write the notes** in `docs/release/v<version>.md`.
4. **Verify locally:**
   ```bash
   node scripts/releaseVersion.mjs --tag v<version>
   node scripts/releaseNotes.mjs check
   npm run typecheck && npm test
   ```
5. **Commit** with `chore(release): prepare Nebula v<version>`, tag `v<version>`,
   and push the branch and tag together:
   ```bash
   git push --atomic origin <branch> refs/tags/v<version>
   ```

To dry-run the whole pipeline without publishing, run the **Release** workflow
manually (`gh workflow run release-desktop.yml --ref <branch>`). It builds every
target but doesn't push images or create a release.

## What the workflow publishes

`.github/workflows/release-desktop.yml` runs on `v*` tags:

| Target | Output |
| --- | --- |
| Windows x64 | `Nebula-<version>-setup.exe`, `.appx` and `latest.yml` for auto-update |
| macOS arm64 | `Nebula-<version>-arm64.dmg`/`.zip` and `latest-mac.yml` |
| Web | `Nebula-<version>-web.zip`, the static bundle for any web host |
| Docker | `lilremark/nebula-music` for `linux/amd64` and `linux/arm64` |

Docker tags:
- **Stable:** `<version>`, `<major>.<minor>` and `latest`.
- **Beta:** `<version>` and `beta`.

Publishing needs the `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` repository
secrets. A Docker Hub access token with read and write scope is enough.

The GitHub release body is the rendered notes followed by the install caveats.
Beta tags (`-beta.`) publish a pre-release immediately so the beta update
channel sees them; stable tags create a draft to review and publish.

Earlier versions' in-app notes are archived in [history.md](history.md).
