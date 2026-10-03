# Local AI DJ beta review

This feature is intentionally developed directly from `origin/beta`, at the
user's request, as an exception to the repository's usual main-first workflow.
The starting commit is `f2a955b` (2.5.0-beta.20), which includes beta.19 and the
subsequent taskbar fix. The primary design checkout is untouched. Publishing
a beta release remains a separate action; this branch produces review builds.

## Behavior

Start a session from AI DJ under Discover. Settings contains preferences, voice preview, readiness, and learning reset. DJ saves the previous queue
and position, greets once, then introduces sets after four or five natural track
completions. Explicit skips influence recommendations without advancing that
counter. Stop DJ leaves its music queue playing; Return to previous queue restores
the saved queue and position. Manual music selection, Instant Mix, or radio
takeover ends DJ. Repeat overrides are unavailable until the session ends.

Balanced selects approximately three familiar and two less-played related songs
per five-track block. Familiar and Discover change that ratio. Related candidates
come from server similarity and genre endpoints, with library variety as fallback.
Historical statistics contribute candidates only when the track is found in
current library results. Short libraries relax repeat exclusions instead of inventing unavailable songs.
Likes and existing account-scoped play counts seed a new profile. Legacy unscoped
track-start history is deliberately not assigned to an account. Reset DJ learning
clears that account's DJ events; likes and play counts stay saved.

Listening events are scoped to normalized server URL and username. A single clock
tracks actual heard time, excluding seeks, stalls and pauses, and drives qualified
scrobbling/statistics once per playback instance. Natural completion is distinct
from qualification. During a Store handoff, the incoming media owner becomes the
clock source; ended audio waiting for voice cannot create a duplicate completion.

Standalone voice suppresses crossfade at the set boundary. Over-music voice lowers
the music input by 12 dB and restores its gain smoothly. The voice branch has its
own analyser and gain, follows master volume/mute, and bypasses music speed/pitch
and EQ. Pause and Next operate on the active voice/session through the Store,
including tray, media-key and mini-player commands. The ORB-21 cover samples actual speech audio and stops rendering when hidden, offscreen, paused, or reduced motion is enabled.

Only prepared audio plays at a boundary. Late work is skipped; music continues.
Session/profile/request revisions discard obsolete results. Model errors use a
grounded introduction; missing voice output produces a recoverable error and
continues playback. Helpers launch lazily and release on stop or preview end.

## Models, grounding and packaging

The shipped text model is SmolLM3-3B Q3_K_S, generated from the pinned upstream
FP16 GGUF with llama.cpp b11366. Q4_K_M was tried first: its NSIS archive exceeded
the embedded installer limit and AppX reached 2.32 GiB. Q3 uses the same 3B model
and fits a single offline installer and normal updater.

The CPU-only helper is hidden, bound to authenticated 127.0.0.1, and runs in
offline mode. Kokoro-82M v1.0 quantized ONNX runs in an Electron utility process,
using Michael or Heart and the bundled eSpeak NG phonemizer. No model service,
API key, Python, GPU, or runtime model download is required. Old cloud settings
and vault secrets are preserved and inactive.

Free-form Q3 evaluation invented artists despite a grounding prompt. The final
JSON response schema constrains the model to complete introductions composed
from verified track metadata and taste evidence. The model selects suitable
phrasing; unrecognized output falls back locally. This intentionally limits v1's
spoken variety to keep every introduction grounded and bounded to two sentences.
It does not generate artist trivia or infer personal emotions.

Asset revisions, source weights, quantization hash, package hashes and helper
revision are pinned in `electron/aiDj/assets.lock.json`. Packaging verifies both
downloads and installed resource files. eSpeak NG source/build materials and
redistribution notices accompany the assets. Echogarden's narrow version-pinned
package-manager patch resolves the bundled directory and prohibits downloads.

Build on Windows x64 with Node 24:

```powershell
npm ci
npm run dj:assets
npm run typecheck
npm test
npm audit --audit-level=high
npm run dist:win
node scripts/releaseArtifacts.mjs --platform windows --version 2.5.0-beta.20 --dir release
```

Asset preparation needs roughly 10 GB temporary disk space, including source
weights; the installer includes only the quantized model and inference resources.
The Windows release workflow prepares these assets before packaging. Release
validation rejects any file at or above 2 GiB. Keep the existing app ID and updater
feed unchanged. macOS/browser builds show local DJ as Windows desktop-only.

## Review evidence and remaining acceptance

- Typecheck and the full 425-test suite passed, including runtime corruption,
  synthesis failure/crash, cancellation, account isolation, seek/qualification,
  natural completion, skip handling, late work, ducking, and saved-queue restoration.
- Both cadence choices passed eleven-block session simulations. These are not
  a substitute for a long real-audio session with a connected server.
- 100 local commentary-and-TTS inputs passed with no fallback. On a Ryzen 7
  9800X3D with 32 GB RAM, mean preparation was 7.58 seconds, maximum 12.95 seconds.
  Both voices produced PCM WAV output. This does not certify a 16 GB machine.
- Desktop smoke checks passed for the current players and DJ preview/session,
  dark/light and narrow layouts, accessibility tree, and previous-queue action.
  Audio was muted during automated UI checks.
- Packaged ASAR workers and model resources synthesized both voices with an
  empty voice cache and external model fetch blocked. This validates packaged
  resources without running the NSIS installer on the installed user profile.
- NSIS and AppX build successfully below 2 GiB. Windows installers are unsigned.

Before publishing, manually verify a 16 GB CPU-only machine, real server access,
more than ten real blocks, sleep/resume and hidden-window playback, audible
transition/gain quality, both voices' pronunciation, reduced motion with assistive
technology, and a real beta.19 installer upgrade. The review environment does not
provide that hardware/server listening acceptance. Use a disposable profile for
package verification; do not overwrite the user's installed profile.

Reproducible checks: `scripts/smokeAiDj.cjs` exercises desktop UI with offline
music fixtures; `scripts/verifyAiDjRuntime.ts` blocks external fetch, uses an empty
voice cache, and accepts `NEBULA_DJ_RESOURCES` / `NEBULA_DJ_WORKER` for packaged
resource verification. Set `NEBULA_DJ_CASES=100` to repeat the commentary run.
Reports, voice samples and screenshots are written to ignored `release-review/`.

## Discover and player integration

Discover → AI DJ is the session home. Navigating there never starts a session.
The view shows a playlist-style queue, taste explanation, completion progress,
preparation/errors, and Start/Stop/Skip/Return controls. DJ settings links directly
to its settings section. `showTranscript` migrates to true and can be changed
while listening without invalidating a prepared interlude. Transcripts appear
only in Discover, never in a player or desktop snapshot.

All music players use a shared presentation independent of the real track and
queue identity. During voice, their main cover becomes the purple cloud orb,
metadata identifies AI DJ, progress follows speech, and seeking/track actions are
disabled. Next skips speech, including from the native mini-player. Paused speech
keeps static cover/haze; finish, skip, stop, error, and profile changes clear it.
Voice previews reuse presentation but do not start sessions or create queues.
The expanded player retains Now Playing and Queue during DJ; its queue includes
a compact standard transport. Lyrics return for ordinary music playback.

Shadercn ORB-21 is vendored at revision
`7569572e3c5b7e76f630868d27b9f3fc3a5328ad`, with vgpu 0.4.0,
TypeGPU 0.12.6 and unplugin-typegpu 0.12.4. The runtime is MIT; **the shader
itself is non-commercial only, with attribution to XorDev**, as documented in
its source. Both notices ship in `electron/assets/shadercn-NOTICE.txt`.
GPU rendering is optional: a bundled static SVG handles reduced motion,
unavailable WebGPU, initialization failure and device loss. The source frame
loop is capped at 30 fps and DPR 1.5; renderer resources are disposed when hidden,
paused, offscreen or unmounted. Frontend shader packages are build dependencies;
the compiled shader is included in the offline application.

Desktop snapshots carry validated presentation/progress only. A separate bounded
10 Hz energy channel operates only while the mini-player is visible. Main-process
sender validation restricts publication to the playback owner. Mini-player
rendering remains a remote client with no audio owner or inference process.

Run `node_modules/electron/dist/electron.exe scripts/smokeDjUi.cjs` after building
for an offline fixture check of Discover, settings, transcription, native energy,
voice preview, all player covers, actual WebGPU painting, and artwork restoration.
The fixture supplies prepared voice audio rather than evaluating local models;
real-server and reference-hardware checks remain the separate acceptance tests above.

### Updated integration review

- Typecheck, all 436 tests in 64 files, Electron build and dependency audit pass
  (zero reported vulnerabilities).
- Offline UI smoke checks pass for Discover navigation, settings separation,
  live transcription opt-out, actual WebGPU frames, paused/static covers, all
  player layouts, native energy synchronization and track restoration after Next.
  The existing player smoke and real local-model preview/session smoke also pass.
- Packaged ASAR UI and both bundled voices pass with external model fetch blocked
  and an empty voice cache. The two packaged commentary/TTS runs completed in
  9.63 and 7.91 seconds on the review machine.
- The beta.20 review installer and AppX remain below the 2 GiB release limit;
  Authenticode reports NotSigned. This build has not been published or installed
  over the user's current profile. The manual acceptance items above remain open.
