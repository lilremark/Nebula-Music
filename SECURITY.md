# Security Policy

## Supported Versions

Security fixes are applied to the latest released version of Nebula Music.
Users should upgrade to the newest release before reporting an issue or
requesting support.

| Version | Supported |
| --- | --- |
| 2.4.2 | Yes |
| 2.4.1 and older | No |

## Reporting a Vulnerability

Do not open a public GitHub issue, discussion, or pull request for a suspected
security vulnerability.

Email vulnerability reports privately to:

**remark@remark.rip**

Include as much of the following information as possible:

- A description of the vulnerability and its potential impact
- Affected version, commit, or deployment configuration
- Reproduction steps or a minimal proof of concept
- Relevant logs, requests, responses, screenshots, or code locations
- Any known mitigations or suggested fixes
- Your preferred name or attribution, if any

Remove passwords, Subsonic tokens, salts, API keys, private server URLs, and
personal media metadata before sending the report.

Reports will be reviewed privately. Please allow time to reproduce, assess, and
prepare a fix before publishing details. Coordinated disclosure is appreciated.

## Scope

Examples of relevant security issues include:

- Authentication or credential exposure
- Cross-site scripting or unsafe HTML handling
- Requests leaking credentials to unintended servers
- Dependency or container vulnerabilities affecting Nebula deployments
- Bypasses of security controls in the application or Docker configuration
- Desktop-app (Electron) specific issues:
  - Credential vault (safeStorage/DPAPI) weaknesses or plaintext credential
    leakage to the renderer
  - IPC handler validation gaps that let untrusted content read or write
    credentials or files
  - Unsafe handling of the custom `app://nebula` protocol or the media proxy
  - Auto-update integrity issues (e.g. a compromised `latest.yml` or installer)

General bugs, feature requests, and server-specific compatibility problems that
do not have a security impact should be reported through the public GitHub issue
tracker.

## Security in the Desktop App

Nebula's Windows desktop build (Electron) stores credentials in the operating
system's encrypted credential vault (`safeStorage` / DPAPI) rather than
plaintext. The renderer runs with `contextIsolation`, `sandbox`, and
`webSecurity` enabled, and vault IPC handlers validate that requests come from
trusted app windows. Subsonic passwords are salted and tokenized; API keys are
sent only to the configured server over the app's proxy. Never include vault
contents, `app://nebula` proxy URLs with embedded credentials, or full signed
stream URLs in a security report without redacting them.

