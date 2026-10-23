# Playback feedback on current GitHub main

Date: October 23, 2026.

Base: freshly fetched `origin/main`, commit `72d7a99` (Nebula 3.0.0, merge of PR #39). Branch: `codex/playback-status-current`.

This checkout was created directly from GitHub main. Existing UI, platform, networking, and Docker files were taken from that commit. The previous `codex/design-test` UI was not copied into it. Dependencies were installed from the current lockfile with Node 24.19.0 and `npm ci`.

## Changes

- Adds Loading track, Buffering, and persistent playback-error feedback to the current floating dock, sidebar, floating player, and full-screen player.
- Tracks only the active music element, including crossfade handoffs. Background preloading does not trigger the indicator. DJ speech holds do not look like music buffering.
- Clears pending feedback after playback resumes or pauses. Terminal failures allow Play to retry or the listener to skip the track. Existing cancellation guards prevent late play rejections from changing a different playback request.
- Checks server reachability on connection, every 15 seconds, on focus, after reconnect, and through Retry connection. Offline events warn immediately. UI checks have an eight-second deadline; existing bounded and trusted network transports remain intact.
- Shows a top warning while disconnected and clears it after recovery. The current shared sidebar/drawer server status reflects the same state while retaining its sanitized server identity.
- Keeps expanded music and radio header controls accessible below the warning.
- Restores previous service credentials after a failed Save & Connect attempt.

The requested Desktop Settings gate already exists on this GitHub baseline. It was retained and verified rather than rewritten: web/Docker hide Desktop; desktop platforms retain it. Windows-only AI DJ gating is also unchanged.

## Verification

| Check | Result |
| --- | --- |
| Current lockfile installation, Node 24 | PASS |
| TypeScript | PASS |
| Unit/integration suite | PASS: 70 files, 473 tests |
| Electron main/preload/voice worker and production renderer build | PASS |
| Native Electron player UI smoke | PASS: player exclusivity, waveform, sidebar dimensions, narrow dock, full-screen layering, theme, collection headers, search modal |
| Platform smoke | PASS: web, macOS, Windows navigation/settings; unsupported AI DJ runtimes remain unused |
| Local Docker build | PASS: `nebula-music:playback-status-current`, linux/amd64 |
| Hardened container runtime | PASS: read-only filesystem, dropped capabilities, no-new-privileges, localhost-only port 18081 |
| Docker HTTP-origin smoke | PASS: `http://nebula-docker.test:18081`, health, headers, routing, Settings, mobile navigation, themes, decoded audio, pause/resume/mute/next |
| Feature browser smoke against built preview | PASS |
| Feature browser smoke against the actual NGINX container | PASS |
| Whitespace check | PASS: `git diff --check` |

Feature browser smoke uses a disposable profile, a routed Subsonic test server, and generated WAV audio. It signs in through the actual setup form. No personal server is contacted. Initial audio loading and playback use actual media responses; underrun/error events are injected for deterministic coverage.

Recorded interactions:

- Play with the stream withheld: loading text appears; releasing the stream starts playback and clears the text.
- Waiting then playing: buffering appears and clears.
- Pause then resume: pending feedback clears and playback resumes.
- End track: the Store advances to the next item and plays it.
- Media error then Play: persistent failure guidance appears; retry clears it.
- Refuse server pings while the browser is online: top warning appears and sidebar changes to Offline.
- Retry while unavailable: warning persists. Restore server and activate Retry with Enter: warning clears.
- Expand and close during an outage: warning remains visible and Close player remains operable.
- Settings: Desktop is absent in web/Docker; Sound selects the real Sound tab.
- At 390 x 844 in light and dark themes: banner and current floating dock fit without horizontal document overflow.
- Reduced motion: buffering spinner does not animate. Browser page errors: none.

Local runtime: `http://127.0.0.1:18081`. Production preview: `http://127.0.0.1:3013`. Docker image is local only; no image or release was published. The Docker test covers amd64; arm64 was not rebuilt for this change.

The baseline development dependency scanner reports unresolved shader aliases, while its production build succeeds. Validation therefore used the built production files and the actual container. Shader and Vite configuration were preserved.

## Antislop delivery gate

Scope: the added status and connection feedback, applied to the current GitHub UI. Direction: existing OLED-black/light Nebula 3.0 interface, current floating dock and sidebar, existing typography. ENERGY 1 / RHYTHM 1 / MOTION 1. Amber identifies an outage; the loader only moves while waiting for audio, and honors reduced motion.

| Gate | Result and evidence |
| --- | --- |
| R-02 copy | PASS: direct status/recovery labels; no em dashes in new UI copy. |
| R-03 responsive | PASS: 390px screenshots and overflow assertion; Retry has a 44px minimum height. |
| R-17 numbers | PASS: no invented product metrics. |
| R-18 testimonials | PASS: none introduced. |
| R-23 assets | PASS: no product imagery introduced; test artwork is labeled Test server. |
| R-24 navigation | PASS: current platform gates retained and tested. |
| R-25 contrast | PASS: measured status/error pairings are at least 6.95:1; warning pairings and hover states at least 6.64:1. |
| R-26 interactions | PASS: recorded playback retry, network retry, keyboard recovery, close/expand, and Settings actions work. |
| R-27 states | PASS: idle renders no indicator; loading, buffering, and error have explicit text. |
| R-28 FAQ | PASS: none introduced. |
| R-32 keyboard | PASS: native Retry button, visible focus outline, Enter activation tested. |
| R-33 implementation | PASS: React/CSS/Store implementation; no runtime source rewriting. |
| R-34 themes | PASS: current light and OLED-black themes browser-tested. |
| R-35 running validation | PASS: production build, native UI, Docker runtime, and click-through above. |
| R-36 claims | PASS: no fabricated customer, security, or performance claims. |
| R-37 direction | PASS: current GitHub UI retained; scoped design read recorded above. |
| R-38 content | PASS: feedback follows real state; fixture content is explicitly test data. |
| R-01 color purpose | PASS: amber is limited to connection trouble. |
| R-04 icon purpose | PASS: network/error/loader glyphs explain the accompanying text. |
| R-06 typography | PASS: current app typography retained for supporting labels. |
| R-07 backgrounds | PASS: no decorative background added. |
| R-08 arrows | PASS: none added. |
| R-09 badges | PASS: status surfaces communicate actual pending/error state. |
| R-10 glass | PASS: none added. |
| R-12 shadows | PASS: none added. |
| R-13 glow | PASS: none added. |
| R-14 cards | PASS: no card layout added. |
| R-19 motion | PASS: functional loader only; reduced-motion assertion passes. |
| R-22 illustrations | PASS: none added to the product. |
| Dials and consistency | PASS: low-emphasis supporting labels, current layout, limited functional motion. |
| Focal point | PASS: current track remains central; outage feedback is elevated when actionable. |
| Whitespace | PASS: warning sits above navigation and status sits beside the track. |
| Accent | PASS: outage color has a single semantic purpose. |
| Identity | PASS: current Nebula dock/sidebar/typography remain intact. |
| Design read | PASS: direction and dials above govern the scoped additions. |
| C-1 intent | PASS: each label, icon, and color represents a real state. |
| C-2 completeness | PASS: playback and server recovery controls exercised. |
| C-3 composition | PASS: current layout retained; only requested feedback added. |
| C-4 resilience | PASS: idle/loading/error, themes, mobile, keyboard, and reduced motion covered. |
| C-5 evidence | PASS: commands, fixtures, screenshots, and testing limits recorded. |
| R-05 composition | PASS: current GitHub layout retained. |
| R-11 radius | PASS: compact status/button shapes without introducing capsule layouts. |
| R-15 action labels | PASS: Retry connection names its action. |
| R-16 buzzwords | PASS: none introduced. |
| R-20 identity | PASS: current Nebula visual language retained. |
| R-21 theme choice | PASS: current theme choice retained and tested. |
| R-29 palette | PASS: current neutrals plus a semantic warning color. |
| R-30 originality | PASS: no external product design copied. |
| R-31 purpose | PASS: status preserves track context; warning makes recovery visible. |

Screenshots in `out/playback-status/`: `desktop-loading.png`, `desktop-disconnected.png`, `desktop-dark.png`, `web-settings.png`, `mobile-light.png`, and `mobile-dark.png`. They show the current production build served by the tested container.
