# Nebula 3.0 release review

Reviewed October 9, 2026 against the beta.30 source plus the stable integration
changes, in an isolated worktree. The installed account and personal music
server were not used. This is a focused code review and automated dependency
scan, not a penetration test or a guarantee of absence of vulnerabilities.

## Dependencies

The initial full npm audit reported five moderate findings, all propagated
from `sprintf-js` through `roarr`, `global-agent`, the nested ONNX installer,
and EchoGarden. No high or critical findings were reported. The nested ONNX
runtime's proxy helper now uses `global-agent` 4.1.3, removing the vulnerable
logging dependency chain without changing EchoGarden's native inference ABI.
The ONNX install script uses the supported `bootstrap()` API.

All direct production and development packages were compared with live npm
stable `latest` tags and updated. Changes include Electron 44.7.0, Motion and
Framer Motion 14.0.0, Vite 8.3.4, lucide-react 1.54.0, and WebGPU tooling.
Registry `dist-tags` were checked directly; `npm outdated` subsequently reported
older jsdom/Vitest tags despite `npm view` returning the installed versions as
`latest`. Those packages were retained at the verified latest versions.
A fresh `npm ci` succeeds and the complete
`npm audit --audit-level=low` reports **zero known vulnerabilities**, including
development dependencies. Release and app-verification CI now reject any
audit severity. An explicit Electron runtime installation step supports the
current Electron package's on-demand installation model for native smoke tests.

Declared dependency licenses were inventoried from the lockfile. Existing
EchoGarden/eSpeak LGPL/GPL components and redistribution notices remain part
of the distribution; no licensing certification is claimed. Direct and nested
ONNX Runtime and EchoGarden import successfully. Pinned Windows DJ helper
assets and redistribution notices pass checksum verification. Optional models
remain separate user downloads.

## Code review

Inspected renderer custom-protocol containment, proxy handling, redirect
validation, IPC/preload boundaries, native external links, credential vault,
settings persistence, Subsonic authentication/transport and account caches,
playback ownership and local-DJ downloads/process startup.

Existing protections retained and regression-tested:

- Sandboxed, context-isolated renderers with Node integration disabled;
  restrictive script CSP and denied permission requests.
- Native IPC accepts known windows and bundled main-frame entry documents.
  Remote proxy documents have their own sandbox CSP and cannot navigate the
  native application to a privileged document.
- Renderer assets reject traversal, encoded Windows path separators, alternate
  data streams and malformed paths.
- HTTPS defaults and explicit desktop HTTP opt-in; redirect destinations are
  validated individually and intermediate response bodies are cancelled.
- OS-encrypted credential storage, serialized/recoverable writes and validated
  settings; account-specific cache namespaces and stale-response rejection.
- Bounded artwork downloads, body-aware request deadlines, cancelled waveform
  subscriptions and Store-owned playback/crossfade recovery.
- Pinned and hashed DJ resources, bounded downloads, validated archive paths
  and link rejection, loopback-only inference with a random token, and process
  creation without a shell.

AI DJ was visible on unsupported platforms. Navigation, mobile drawer,
legacy sidebar, direct view selection and settings now share a Windows-only
gate. The desktop adapter and real preload expose no DJ API on macOS, and
the main process registers no model/download/inference handlers there.
Web remains without a native DJ API. Windows sessions still require an
explicit user start; existing model preferences are preserved.

No additional exploitable application vulnerability was confirmed in this
pass. Tests cover the reviewed boundaries; the scan cannot detect unknown
advisories or prove all possible malicious-server behaviors are safe.

## Validation

- Typecheck; 66 test files / 458 tests; configured coverage thresholds pass.
- Web/Electron production build and native dependency imports.
- Desktop startup, taskbar retry/controls, mini-player layout/commands, full
  player/search/collection smoke checks, and EQ audio headroom check.
- Production renderer and real-preload platform matrix: web and macOS show
  no AI DJ navigation/settings and make zero DJ runtime calls; Windows exposes
  the optional feature. Both desktop and compact mobile navigation are checked.
- Player smoke assertion now waits for the completed dark-theme animation
  before testing its final background color.
- Real Computer Use screenshots from a fresh Demo Mode profile. The README
  subsequently uses maintainer-supplied Demo Mode captures to exclude the cursor.

Hosted release CI additionally builds Windows x64 and macOS arm64, runs native
startup/platform smoke checks on both hosts, checks bundle version/architecture,
and validates installers, archives and updater metadata before assembling the
draft release. Publication follows successful artifact verification.

## Sources

- [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security/)
- [Motion 14 upgrade guide](https://motion.dev/docs/react-upgrade-guide)
- [global-agent bootstrap API](https://github.com/gajus/global-agent/blob/main/README.md)
- [sprintf-js advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c)
