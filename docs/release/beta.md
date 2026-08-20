# Beta release channel

Nebula's beta channel delivers pre-release builds to users who switch their
update channel to **Beta** in Settings. Pre-release builds are published from
the `beta` branch; stable releases are published from `main`.

## How the channel works

The stable/beta toggle is an in-app setting that maps to
`electron-updater`'s `allowPrerelease` (`electron/updater.ts`):

- **Stable** (`allowPrerelease = false`) — the updater reads the latest
  published **non-prerelease** GitHub release.
- **Beta** (`allowPrerelease = true`) — the updater also considers GitHub
  releases marked as **Prerelease**.

The updater always reads the `latest.yml` that `electron-builder` publishes;
the channel is never a separate filename. Pre-release versions use semver
prerelease tags (`2.5.0-beta.1`). See
[ADR 0004](../adr/0004-beta-release-channel.md) for the rationale.

## Branch model

- `main` is the source of truth. All features land on `main` first.
- `beta` is an **ephemeral snapshot line** cut from `main` for pre-release
  cycles. It is never merged back into `main`.
- Promotion to stable is simply cutting a stable `v*` tag from `main`; the
  code already lives there.

## Cutting a beta pre-release

1. Check out `beta` and sync it to the current `main`:
   ```bash
   git checkout beta
   git merge main
   ```
2. Bump the version to the next pre-release (`x.y.z-beta.n`) across all
   version sources:
   ```bash
   node -e "const fs=require('fs');const f=u=>JSON.parse(fs.readFileSync(u,'utf8'));const w=(u,v)=>{const j=JSON.parse(fs.readFileSync(u,'utf8'));j.version=v;j.packages[''].version=v;fs.writeFileSync(u,JSON.stringify(j,null,2)+'\n')}"
   ```
   Then set `version` in `package.json`, both `version` fields in
   `package-lock.json`, and `APP_VERSION` in `constants.ts`. Add a matching
   entry at the top of `CHANGELOG` in `constants.ts`.
3. Verify all sources agree:
   ```bash
   node scripts/releaseVersion.mjs --tag "v2.5.0-beta.1"
   ```
4. Commit and tag:
   ```bash
   git add package.json package-lock.json constants.ts
   git commit -m "chore(release): prepare Nebula v2.5.0-beta.1"
   git tag v2.5.0-beta.1
   ```
5. Push the branch **and** the tag to trigger the release workflow:
   ```bash
   git push origin beta
   git push origin v2.5.0-beta.1
   ```

## What the workflow does

`.github/workflows/release-desktop.yml` runs on `v*` tags:

- Any tag containing `-beta.` is treated as a **beta pre-release**:
  - builds Windows only (macOS is skipped),
  - publishes a **published GitHub Prerelease** immediately (drafts are
    invisible to the updater, so a beta must be published to be delivered).
- Any other `v*` tag is a **stable release**:
  - builds Windows and macOS,
  - creates a **draft** GitHub release for a human to review and publish.

## Promoting beta to stable

When a beta line matures:

1. The feature work is already on `main` (features land there first).
2. Bump `main` to the stable version, commit, and tag `vx.y.z`.
3. Push the tag; the workflow creates the draft release. Review and publish it
   in GitHub.
4. Users on the **Stable** channel receive it via `/releases/latest`.

## Notes

- Windows beta builds are unsigned and may trigger SmartScreen on install;
  updates download and install automatically once installed.
- Stable users are never offered pre-release builds.
