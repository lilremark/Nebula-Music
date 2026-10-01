# Windows Electron and web security/performance review

Reviewed September 30, 2026. Changes are isolated on `codex/security-performance-review` in the attached review worktree. The original checkout and its unfinished redesign remain untouched. The review copy includes the existing redesign, not just committed production code. No release, remote push, installer execution, or account connection was performed.

## Result

Fixed security boundaries, account isolation, playback/network resource leaks, asynchronous UI races, persistence reliability, and update behavior. Updated every direct npm dependency to the live registry's stable `latest` tag and refreshed compatible transitive dependencies. The baseline npm audit reported **12 vulnerable packages: 9 high and 3 moderate**. The updated lockfile reports **zero known npm audit vulnerabilities**, including development dependencies. This is a scanner result, not proof that the application has no vulnerabilities.

## Findings and changes

| Priority | Finding and impact | Remediation and evidence |
| --- | --- | --- |
| High | The Electron media proxy could serve upstream HTML on the privileged app origin. Navigation allowed arbitrary paths on that origin, while vault authorization trusted the entire window rather than its current document/frame. | Restrict navigation and native IPC to bundled main-frame documents in known windows; sandbox proxy responses. `electron/rendererSecurity.test.ts` rejects proxy URLs, other hosts, subframes, and untrusted entry paths. This was a demonstrated trust-boundary defect; an unauthenticated remote exploitation chain was not demonstrated. |
| High | Custom protocol filesystem containment used a string prefix and did not safely handle Windows backslashes, decoded traversal, or alternate data streams. | Decode once and resolve with filesystem containment rules. Tests cover encoded traversal, sibling paths, drive paths, malformed encoding, NUL, and alternate data streams. |
| High | HTTP consent was checked only before a request; automatic redirects could downgrade an approved HTTPS request. New desktop settings also enabled HTTP by default. | Validate every redirect hop, cancel intermediate bodies, reject embedded URL credentials, default new settings to HTTPS, and add explicit HTTP consent in Setup and Settings. Existing saved `true` values are preserved. Consent remains a desktop-wide setting, not the per-profile model originally proposed in ADR 0003. |
| High | The existing dependency graph contained Electron sandbox/preload/protocol advisories and vulnerable native/build/test packages. | Electron 44.5.1, ONNX Runtime 1.30.0, sharp 0.35.5, Vitest 5.0.3 and compatible transitive patches; npm audit reports zero. See package/lockfile diffs for exact versions. |
| High | Persistent Subsonic caches used global keys, allowing one server/account's library to appear after switching accounts with overlapping IDs. | Namespace all API caches by server/account, reject requests/cache reads across credential changes, and avoid placing API keys in cache identifiers. Regression tests use different servers and accounts sharing IDs. Old unscoped cache entries are ignored rather than reused. |
| High | Waveform requests downloaded entire tracks without releasing stale requests, exhausting the browser's per-server connection pool after repeated track changes. | Restore shared, reference-counted subscriptions; abort when the final subscriber releases; fetch only while waveform mode is selected. Real hook and loader tests verify sharing and cancellation. Waveform peak cache is bounded to 128 entries. |
| High | Crossfade could prepare while disabled, and a stalled owner handoff could leave the queue frozen after the secondary audio element ended. | Gate preparation/activation on the setting; add secondary-owner ended recovery; remove stale metadata listeners and handoff timers. Real Store tests cover eight-track progression, enabled/disabled crossfade, and interruption. The single playback owner architecture is preserved. |
| Medium | Live-radio metadata probes without ICY metadata could leave response bodies open; obsolete HLS instances and play failures could affect replacement stations. | Abort all probes on completion, destroy HLS instances on unmount, and ignore stale playback failures. |
| Medium | Concurrent vault writes shared one temporary filename; a failed settings write poisoned the write chain. | Serialize vault writes and let subsequent vault/settings writes recover after rejection. Concurrent-write and failure-recovery regressions added. Credentials remain OS-encrypted. |
| Medium | IndexedDB write promises resolved before commit; concurrent play-count read/write transactions lost increments. | Resolve writes on transaction completion, reject aborts, and increment within one transaction. Thirty simultaneous updates preserve all counts. Version 4 adds a server index; migration tests preserve existing version 3 statistics. Most-played reads no longer scan every server's statistics. |
| Medium | Slow API/artwork/lyrics responses could leave operations pending indefinitely; artwork size was unbounded. | Apply body-aware web deadlines, a desktop JSON deadline, and an 8 MiB streamed artwork cap. Oversize artwork is cancelled even without Content-Length. Authenticated browser API redirects are rejected; configure the canonical server URL. |
| Medium | Server URL query parameters could contaminate generated API authentication URLs; biography parsing could load server-supplied elements. | Clear inherited query/fragment parameters, validate HTTP(S) base URLs without userinfo, and parse biographies in inert templates. Preserve LAN endpoints and reverse-proxy base paths. |
| Medium | Search and artwork requests could finish out of order; tainted artwork canvases could fail color extraction and leave stale loading state. | Ignore superseded results, clear pending focus timers, handle canvas failures, and bound adaptive-color caches. Real hook tests cover late image responses and tainted canvas. |
| Medium | Electron CSP excluded blob speech audio and blob HLS workers. | Permit blob media and explicit blob workers while keeping scripts restricted and proxy documents sandboxed. This restores the policy requirements for speech playback and HLS worker processing; live speech/model synthesis was not exercised. |
| Medium | Checking for updates after an installer had downloaded removed the available install/restart action. | Keep downloaded updater state intact; regression test verifies it. Taskbar progress toggles also reset cached state. |
| Medium | All views shipped in the main web JavaScript chunk; a missing route chunk after deployment could unmount playback with the global error boundary. | Lazy-load views while keeping playback mounted; add a route error boundary and recovery action. Browser testing reproduced the old-chunk failure, and a regression verifies playback remains mounted when a route fails. |
| Medium | Docker had no CSP or framing protection, and NGINX location-specific headers could bypass inherited security headers. | Add shared headers in every applicable location: own scripts, required fonts/media/LAN/network endpoints, blob workers, no framing, no referrer, no unused browser permissions. Equivalent headers are needed on non-Docker static hosts. |
| Medium | Most pull requests outside Stream Deck paths had no broad app verification. | Expand CI to app sources, beta pushes, web/Electron builds, audit, and NGINX syntax validation; update verified stable GitHub Action pins and disable persisted checkout credentials. Hosted CI has not run in this local review. |
| Medium | AI DJ settings advertised queue curation, but the orchestrator is never instantiated/called by the application. | Gate the unfinished panel with a narrow reversible constant, preserving implementation and saved configuration. This restores the prior disabled-for-now behavior on the reviewed branch. Completing queue orchestration remains a separate feature task. |
| Low | Repeated AutoEQ lookups re-fetched and re-parsed its large index and accepted unvalidated profile paths. | Deduplicate index requests, retain a validated in-memory index, and reconstruct profile URLs from trusted repository paths. |
| Low | Inline Electron sourcemaps significantly inflated startup bundles. | Make inline maps opt-in with `NEBULA_DEBUG_BUILD=1`. The main bundle decreased from approximately 3.8 MiB to 1.3 MiB despite dependency updates. |

## Dependencies and compatibility

All direct npm packages were compared against live stable registry tags. Major updates include React/React DOM 19.3.0, Motion/framer-motion 13.4.6, Electron 44.5.1, TypeScript 7.0.2 and Vitest/coverage 5.0.3. Vite is 8.3.1 and hls.js is 1.7.3. Build and integration checks passed after these updates.

Development requires Node **22.22.2+, 24.15.0+, or 26+**; Node 24 LTS is the development/CI choice. Validation used the bundled Node 24.19.0 because the machine's default Node 25.2.1 is outside the current Vitest/jsdom engine ranges. README and contributing instructions reflect the new requirement.

Echogarden 3.4.0 still pins a compatible nested ONNX Runtime 1.21.1. The application's direct ONNX dependency is 1.30.0; both native runtimes and Echogarden imported successfully. Transitive dependencies follow their parents' supported constraints rather than being forced to incompatible majors. Both required ONNX installation script versions remain allowed. No dependency overrides or legacy peer-dependency bypasses were used.

## Measured build changes

| Artifact | Before | After |
| --- | ---: | ---: |
| Main web JavaScript resource, minified | 771.11 kB | 388.43 kB |
| Same resource, gzip | 222.42 kB | 113.18 kB |
| Electron main bundle | approximately 3.8 MiB | approximately 1.3 MiB |
| Electron preload bundle | approximately 21.5 KiB | approximately 6.3 KiB |

The main web resource is about **50% smaller**. Shared code and visited route chunks are additional downloads; this is not a claim that total startup traffic or CPU use fell by 50%. HLS remains a separate, on-demand chunk. No CPU, memory, battery, or live-server throughput benchmark is claimed.

## Validation

- Baseline: typecheck, 243 tests, web and Electron bundles passed.
- Updated code: typecheck and **313 tests across 43 files** passed with coverage enabled.
- Configured coverage gate passed: 94.85% lines, 86.3% branches, 100% functions. This coverage scope covers selected Stream Deck modules, **not the whole application**.
- Production web and Electron bundles built successfully.
- Actual Windows Electron 44 launched main and mini-player windows with a disposable profile; renderer mount, synchronous preload information, settings IPC and window IPC were checked. Both windows stayed hidden. Media-key registration was unavailable while another desktop session held the shortcuts; installed media-key behavior is not claimed verified.
- The production web build was exercised in the browser: demo entry, Home, album library and Settings navigation. The deployment chunk replacement problem was observed and isolated with a route boundary.
- Native imports passed for Echogarden, sharp and both ONNX runtime versions.
- Windows NSIS installer and APPX packaging completed with native rebuilds. The installer is a local review build retaining version 2.5.0-beta.3, not a published release. Authenticode reports **NotSigned**.
- npm audit reports zero known vulnerabilities, including dev dependencies. Direct stable tag checks passed. Source scans found no matching embedded private keys/GitHub tokens in reviewed source files; this was not a historical Git secret scan.
- `git diff --check` passed.

Useful local commands: `npm ci`, `npm run typecheck`, `npm run test:coverage`, `npm run build:electron`, `npm run test:desktop`, `npm run dist:win`. The desktop smoke test uses an isolated temporary profile and does not exercise an installed account.

## Remaining follow-ups and limits

1. **Before publishing:** sign Windows artifacts with the project's certificate and validate installed update download/restart, tray/media-key behavior and sleep/resume on the intended distribution channel. Local builds are unsigned; no signing credentials were available or requested.
2. **Live compatibility:** authenticated Subsonic servers, large real libraries, HLS/radio recovery and first-time speech-model synthesis need server/model-backed testing. No personal credentials were used. API redirects are intentionally rejected in the browser; users must enter the final canonical base URL.
3. **Docker/CI:** the Docker engine is stopped, so local container build, `nginx -t` and response-header verification are unverified. The added hosted checks must run before release. No global daemon was started. Container base-image vulnerability scanning is outside the npm audit result.
4. **AI DJ:** its queue orchestrator exists and has unit tests but is not integrated into the application's track-completion/session flow. The previously exposed panel is now reversibly gated. Its Anthropic catalog option uses the generic OpenAI-compatible `/chat/completions` client; provider-specific support is required before enabling that configuration. Model availability was not verified against live provider APIs. Existing AI configuration was preserved.
5. **Further performance work:** the monolithic Store context broadcasts frequent playback state to many consumers; selected waveform mode still downloads/decodes a full selected track; some hidden visualizer animation loops continue scheduling under Electron's required background playback policy. Profile real workloads before introducing context selectors, visibility-aware animation suspension or bounded waveform sampling.
6. **Incomplete AutoEQ behavior:** calibration applies filter gains, but the saved preamp is currently display-only, as the Settings UI states. Full calibration needs preamp application in the audio graph and clipping/headroom tests. Index fetch optimization does not complete that feature.
7. **Storage/network policy:** browser credentials remain in same-origin IndexedDB, and Subsonic authentication parameters are necessarily part of generated media URLs. HTTPS remains important. Cache scoping prevents accidental reuse but does not encrypt metadata or clear historical site data. Desktop HTTP consent is still global; profile-scoped consent can be designed separately.

## Primary references

- [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security): IPC sender validation, navigation and current runtime security.
- [Electron 44 migration](https://www.electronjs.org/blog/electron-44-0) and [breaking changes](https://www.electronjs.org/docs/latest/breaking-changes/).
- [Vitest migration guidance](https://main.vitest.dev/guide/migration/) and [Motion upgrade guidance](https://motion.dev/docs/upgrade-guide).
- [NGINX header inheritance](https://nginx.org/en/docs/http/ngx_http_headers_module.html) and [browser redirect handling](https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected).

Security findings remain local; this report was not posted to public GitHub issues, a pull request, or an external service.
