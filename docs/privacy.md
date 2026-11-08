# Privacy: crash reports

Nebula does not collect analytics. The desktop app can send anonymous crash
reports, but only if you turn them on. The web build and Docker image never send
crash reports.

## Turning it on or off

The first time you open a desktop build that supports crash reports, a banner
asks whether to share them. Choosing **Not now**, or not answering, leaves them
off. You can change your answer at any time in **Settings → Desktop → Crash
Reports**.

## What a report contains

When crash reports are on and Nebula hits an error it did not expect, or one of
its processes crashes, it sends:

- the error message and the location in Nebula's code where it happened
- the Nebula, Electron, Chrome and Node versions
- your operating system name and version (for example, Windows 10.0.26200)
- which part of the app failed, such as the main window, the mini-player or the
  GPU process, and the screen you were on (for example, `ALBUM_DETAIL`)
- a random install ID, so that one crash on many computers can be told apart
  from many crashes on one computer

## What is removed or never sent

Before a report leaves your computer, Nebula removes:

- your server's address, and every other web address except Nebula's own
- your username, passwords, tokens and API keys
- file paths that contain your account name (they become `~`)
- email addresses

Nebula does not attach your library, playlists, listening history, screenshots
or logs. The computer's name is not sent. Reports are not linked to your IP
address: the app tells Sentry not to infer one, and the Nebula project in Sentry
is set not to store IP addresses.

Turning crash reports off deletes the install ID. If you turn them on again
later, you get a new one.

## Where reports go

Reports are sent to [Sentry](https://sentry.io), a crash-reporting service, in
its US region, and are used only to find and fix bugs in Nebula.

The code that removes personal data is
[`electron/crashScrub.ts`](../electron/crashScrub.ts); the decisions behind the
feature are in [ADR 0005](adr/0005-anonymous-crash-reporting.md).
