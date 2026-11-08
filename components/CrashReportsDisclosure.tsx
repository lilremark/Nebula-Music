import React from 'react';

/**
 * What an opted-in crash report contains. Shown in the first-run banner and in
 * Settings; keep it in sync with electron/crashScrub.ts and docs/privacy.md.
 */
export const CrashReportsDisclosure: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`grid gap-3 text-xs leading-relaxed sm:grid-cols-2 ${className}`}>
    <div>
      <p className="font-semibold text-neutral-900 dark:text-white">Sent when Nebula crashes</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-white/60">
        <li>The error message and where in Nebula's code it happened</li>
        <li>Nebula, Electron and operating system versions</li>
        <li>Which part of the app crashed, such as a window or the GPU process</li>
        <li>A random install ID, deleted when you turn this off</li>
      </ul>
    </div>
    <div>
      <p className="font-semibold text-neutral-900 dark:text-white">Never sent</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-neutral-600 dark:text-white/60">
        <li>Your server address, username, passwords or API keys</li>
        <li>File paths that contain your account name</li>
        <li>Your library, playlists or listening history</li>
        <li>Your IP address, which is not stored</li>
      </ul>
    </div>
  </div>
);
