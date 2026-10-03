# Local AI DJ on beta

The user requested development and publication directly on `beta` for
2.5.0-beta.22. This is the documented beta-first exception to the usual
main-first workflow; see [beta releases](release/beta.md). Development used the
isolated `codex/local-ai-dj-beta` worktree from beta.20 (`f2a955b`). The primary
checkout's design changes are preserved.

## Sessions and personalization

Start explicitly from Discover → AI DJ. Opening the view never starts playback.
Settings contains preferences, model installation, voice preview and learning
reset. The session saves the previous queue and position, greets once, then
introduces sets after four or five natural track completions. Skips influence
recommendations without advancing that counter. Stop DJ leaves music playing;
Return to previous queue restores the saved queue and position. Manual queue
replacement, Instant Mix and radio takeover end the session.

Balanced targets three familiar and two less-played related songs per five-track
block. Familiar and Discover change the ratio. Candidates come from current
library, server similarity and genre endpoints, with library variety as fallback.
Short libraries relax repeat exclusions rather than inventing unavailable songs.
Likes and account-scoped play counts seed a new profile. Legacy unscoped history
is not assigned to another account. Reset clears that account's DJ events while
retaining likes and existing play counts.

Listening events are scoped to normalized server URL and username. One clock
tracks actual heard time, excluding seeks, stalls and pauses, and drives
qualified scrobbling/statistics once per playback instance. Natural completion
is distinct from qualification. Crossfade handoffs transfer the clock owner;
ended audio waiting for voice cannot create duplicate completion events.

## Playback and presentation

Store owns music and speech. Standalone interludes suppress crossfade at the set
boundary. Over-music interludes lower the music branch by 12 dB and smoothly
restore gain. Speech has its own analyser and gain, follows master volume/mute,
and bypasses music speed, pitch and EQ. Pause and Next control the active speech
through normal transports, tray, media keys and mini-player commands.

Only prepared audio plays at a boundary. Late speech is skipped and music
continues; it never appears halfway through a track. Session/profile/request
revisions discard obsolete work. Model errors use grounded deterministic
commentary. TTS failures produce a recoverable error and continue music. Helpers
start lazily and are released when DJ or voice preview ends.

Discover shows the queue, completion progress, preparation/errors and session
actions. Transcription defaults on, can be changed immediately, and appears only
there. Players retain the real queue/track identity and normal controls. Voice
replaces their main cover/metadata/progress temporarily and disables seeking and
song actions. Pause keeps a static cover and haze; finish, Next, stop, error and
profile changes clear it. Preview uses speech presentation without starting a
session or creating a queue. Sidebar and bottom player show a subtle purple
background throughout active DJ sessions.

Shadercn ORB-21 is vendored at revision
`7569572e3c5b7e76f630868d27b9f3fc3a5328ad`, with vgpu 0.4.0,
TypeGPU 0.12.6 and unplugin-typegpu 0.12.4. The renderer is MIT; **the shader is
non-commercial only, with XorDev attribution**. Both notices ship in
`electron/assets/shadercn-NOTICE.txt`. A static SVG covers reduced motion,
unavailable WebGPU, initialization failure and device loss. GPU rendering is
capped at 30 fps and DPR 1.5, stops when paused/hidden/offscreen, and releases
resources after use. Audio remains usable if visualization fails.

Desktop snapshots contain validated presentation/progress, never transcripts
or audio. A bounded 10 Hz energy channel runs only while the native mini-player
is visible. Sender validation restricts publication to Store's window; the
mini-player remains a remote client without audio or inference ownership.

## Optional models and resource security

Models are **not in the installer**. Settings → AI DJ → Download DJ models
explicitly downloads the official SmolLM3-3B **Q4_K_M** GGUF and Kokoro-82M v1.0
quantized ONNX, English voice assets and eSpeak NG phonemizer. AI DJ starts only
after verification. Downloads total **2,012,743,576 bytes** (2.01 GB / 1.87 GiB).
Allow 5 GB free for installation or 7 GB for repair. Resources persist under
the app's `userData/aiDj/smollm3-q4-kokoro-v1/installed` folder across updates.
There is no first-use automatic download. Cancel/retry/repair are explicit.

Pinned revisions, URLs, sizes and SHA-256 hashes are in
`electron/aiDj/assets.lock.json`; compiled download and extracted-file checksums
are in `downloadCatalog.ts`. Asset preparation checks catalog agreement.
The manager streams downloads to partial files, rejects oversized/truncated or
corrupt responses, validates archive paths and rejects links, verifies every
extracted file, then atomically activates the installation. Completed verified
archives can be reused after failed/cancelled attempts; partial files are removed.
Failed repair preserves the prior installation. Main-process IPC restricts
installation to the trusted playback owner, with no renderer-supplied URLs.

The Windows installer includes only llama.cpp CPU helper b11366 and notices,
including the eSpeak NG corresponding source/build materials. The hidden text
helper uses authenticated loopback and offline inference. Kokoro runs in an
Electron utility process, using Michael or Heart. No API key, Python, Ollama,
GPU or external inference service is required. Echogarden's version-pinned patch
resolves explicitly installed packages and prevents automatic package downloads.
Old cloud settings/vault secrets are preserved and inactive.

Free-form evaluation invented artists. V1 constrains structured model output
to short introductions composed from verified track metadata and taste evidence.
The model selects phrasing; invalid output falls back locally. This intentionally
limits variety to keep commentary grounded and bounded to two sentences. It does
not generate artist trivia or infer personal emotions.

## Build and validation

Windows x64 with Node 24:

```powershell
npm ci
npm run dj:assets
npm run typecheck
npm test
npm audit --audit-level=high
npm run dist:win
node scripts/releaseArtifacts.mjs --platform windows --version 2.5.0-beta.22 --dir release
```

Default asset preparation ships helper/notices only. `--models` is an optional
developer resource preparation mode; rerun default preparation before packaging.
Installer filters exclude GGUF and packages even when developer files exist.
The existing app ID/updater stay unchanged. Every release asset must be below
2 GiB. Browser/macOS builds display the Windows requirement.

Checks cover profile isolation, qualified plays, seeking/skips, selection,
short libraries, both cadences over eleven simulated blocks, ducking, crossfade,
cancellation, stale work, takeover, gain restoration and previous-queue behavior.
Model-manager tests cover explicit download, checksums/size bounds, stalled-request
cancellation, shared requests, cached retries, failed repair, installation markers,
archive traversal/links and verified extraction.

`scripts/smokeDjUi.cjs` uses offline fixtures for navigation, model readiness,
Settings download progress, transcription, all player covers, actual WebGPU
painting, native energy and artwork restoration. It checks Home, Browse, Songs,
Settings and AI DJ at 940/1100/1280 px with an open player sidebar, including at
least 15 px between Home slideshow controls and View Album. README screenshots
come from these actual app captures with demo music/artwork, not a visual mockup.
`scripts/smokeAiDj.cjs` exercises real local preview and session playback in a
disposable profile with verified downloaded resources.

`scripts/verifyAiDjRuntime.ts` blocks external model networking and uses an empty
voice cache. Set `NEBULA_DJ_RESOURCES` to downloaded resources,
`NEBULA_DJ_HELPER_RESOURCES` to packaged helper resources, and `NEBULA_DJ_WORKER`
to the packaged voice worker. `NEBULA_DJ_CASES=100` evaluates bounded commentary
and both voices. Reports/screenshots are in ignored `release-review/`.

A real pinned upstream download and 100 Q4 commentary/voice inputs passed with
zero fallbacks on a Ryzen 7 9800X3D with 32 GB RAM: mean preparation 7.89 seconds,
maximum 13.35 seconds. Both voices produced valid WAV output with external
model networking blocked and an empty voice cache.

Beta.22 Windows review validation passed typecheck, all 448 tests in 65 files, clean
installation, Electron build, zero-vulnerability audit, player smoke checks and
Windows packaging. The NSIS installer is 349,141,041 bytes and AppX is
504,681,212 bytes. Packaged DJ resources total 68,324,854 bytes and contain no
models or voice packages; updater metadata hashes match the installer. Windows
artifacts remain unsigned. `scripts/smokeDjDownload.cjs` verified a real explicit
download through packaged production IPC in an empty profile, then both voices
with source networking blocked. Packaged local commentary/TTS completed in
10.70 and 8.17 seconds without fallback. Packaged UI checks passed all player
layouts, WebGPU, settings and sidebar spacing.

Automated playback checks use muted audio. This does not
certify a 16 GB machine, audible pronunciation or server access. Manual beta
acceptance still includes a 16 GB CPU-only reference machine, more than ten
real-server blocks, sleep/resume/hidden playback, audible transition quality,
assistive technology and a beta.19 installer upgrade. Package smoke checks use
a disposable profile and never overwrite the user's installed profile.
