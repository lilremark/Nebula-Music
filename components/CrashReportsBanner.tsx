import React, { useState } from 'react';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useCrashReporting } from '../hooks/useCrashReporting';
import { CrashReportsDisclosure } from './CrashReportsDisclosure';

/**
 * One-time crash-report consent prompt. Shown only while the user has not
 * answered; either button records the answer, and closing the app without
 * answering leaves reporting off.
 */
export const CrashReportsBanner: React.FC = () => {
  const { state, setEnabled } = useCrashReporting();
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!state?.available || state.consent !== 'unset') return null;

  const answer = async (enabled: boolean) => {
    setBusy(true);
    try {
      await setEnabled(enabled);
    } catch (error) {
      console.warn('[nebula] failed to save crash report preference', error);
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Crash reports"
      data-nebula-crash-reports-banner
      className="border-b border-primary/30 bg-primary/10 px-4 py-2 text-sm text-neutral-900 dark:text-white"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Help fix crashes by sending anonymous crash reports. Off unless you choose Share.</span>
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="inline-flex items-center gap-1 rounded text-xs font-semibold text-neutral-700 underline-offset-2 hover:underline dark:text-white/70"
          >
            What's sent?
            <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(false)}
            className="rounded-lg px-3 py-1 text-xs font-bold text-neutral-700 transition hover:bg-black/5 disabled:opacity-50 dark:text-white/70 dark:hover:bg-white/10"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(true)}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-bold text-black transition hover:brightness-110 disabled:opacity-50"
          >
            Share
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="pb-2 pt-3">
          <CrashReportsDisclosure />
          <p className="mt-2 text-xs text-neutral-600 dark:text-white/50">You can change this any time in Settings → Desktop.</p>
        </div>
      )}
    </section>
  );
};
