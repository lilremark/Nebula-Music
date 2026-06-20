# Security Policy

## Supported Versions

Security fixes are applied to the latest released version of Nebula Music.
Users should upgrade to the newest release before reporting an issue or
requesting support.

| Version | Supported |
| --- | --- |
| 2.1.3 | Yes |
| 2.1.2 and older | No |

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

General bugs, feature requests, and server-specific compatibility problems that
do not have a security impact should be reported through the public GitHub issue
tracker.

