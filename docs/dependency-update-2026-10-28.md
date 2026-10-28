# Dependency update: October 28, 2026

Updated the beta source after ReplayGain commit `f42c15f`. The initial npm audit
reported four vulnerable packages: Electron, fast-uri, undici, and Zod, with
three high and one moderate package-level findings. `npm audit fix` cleared
those findings; the remaining direct dependencies were then updated against
the npm registry's stable `latest` tags.

All **41 direct production and development dependencies** match their registry
`latest` version, including the newly declared shader-preparation dependency.
Twenty existing direct packages changed versions. Notable updates:

| Package | Previous | Updated |
| --- | --- | --- |
| Electron | 44.7.0 | 45.1.0 |
| electron-builder | 26.15.3 | 26.18.0 |
| electron-updater | 6.8.9 | 6.8.11 |
| React / React DOM | 19.3.0 | 19.3.1 |
| Motion / Framer Motion | 14.0.0 | 14.7.1 |
| ONNX Runtime | 1.30.0 | 1.31.1 |
| Zod | 4.6.5 | 4.6.7 |
| Vite | 8.3.4 | 8.3.5 |
| Vitest / coverage-v8 | 5.0.3 | 5.0.5 |
| TypeGPU | 0.12.7 | 0.12.9 |
| unplugin-typegpu | 0.12.5 | 0.12.7 |
| vgpu | 0.5.0 | 0.6.0 |

The lockfile refresh also updates compatible transitive dependencies. Existing
proxy/MCP overrides now require the current supported versions. Scoped overrides
select plist 3.1.1 for the two Electron signing tools and ws 8.22.0 for the speech
SDK, within their declared dependency ranges. Other parents retain their own
constraints: Echogarden 3.4.0, itself the latest release, still requires ONNX
Runtime 1.21.1; app-builder-lib pins plist 3.1.0. Optional peers can also reuse
older compatible versions. These upstream requirements were not replaced with
incompatible versions simply to make transitive `npm outdated --all` empty.

The ONNX installation-script allowance now includes 1.31.1 and preserves the
nested 1.21.1 allowance. Optional Node-side WebGPU installation scripts remain
blocked by the existing policy; the app uses Electron's browser WebGPU runtime.

## Compatibility changes

vgpu 0.6 requires prepared shader objects. The orb renderer now prepares its
TypeGPU-generated WGSL once per variant and caches that object across renderer
instances. `@vgpu/wgsl` 0.6.0 is declared directly, matching the runtime version.
The real Electron UI check confirms both WebGPU canvases paint and animate.
See the upstream [vgpu migration guide](https://github.com/vercel-labs/vgpu/blob/v0.6.0/docs/migrations/0.6.0.docs.md).

The sandboxed preload does not use the Node shims removed by Electron 45.
The existing synchronous safeStorage adapter still works in 45, although that
API is deprecated for removal in 46. See Electron's
[breaking changes](https://www.electronjs.org/docs/latest/breaking-changes).

## Verification

Validated on Windows with Node 24.19.0 and npm 12.2.1:

- Clean `npm ci`, including the Echogarden postinstall patch.
- `npm audit --audit-level=low`: zero known vulnerabilities at every severity.
- `npm outdated --json`: `{}`; all 41 direct installed versions independently
  compared with live registry metadata.
- `npm ls --all`: no invalid dependencies, missing required peers, or extraneous
  packages. npm 11.6.2 falsely reported compatible tar/debug versions as invalid;
  npm 12.2.1 validates the same ranges correctly.
- Typechecking and the full 72-file, 484-test suite, including coverage gates.
- Web production build and Electron main/preload/voice-worker builds.
- Electron startup and native mini-player startup.
- A real OS-backed safeStorage encryption/decryption round trip on Electron
  45.1.0 using a disposable profile and fixture text.
- Navigation/settings smoke checks for web, macOS platform info, and Windows
  platform info; these are not native macOS execution tests.
- Real Electron DJ UI checks, including animated shaders and player surfaces.
- Built web ReplayGain checks: live settings, persistence, crossfade gains,
  dark/light layouts, keyboard preamp control, and measured Web Audio output.
- CPU identity-model inference using both ONNX Runtime 1.31.1 and the nested
  1.21.1; each returned the expected value 3.25. Echogarden imported and sharp
  generated a PNG successfully.

Declared licenses were inventoried from the lockfile. The added shader helper
is MIT-licensed; existing third-party notices remain applicable. This is a
dependency update and regression check, not a security or licensing certification.
