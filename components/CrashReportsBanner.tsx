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

  // Shared banner layout and tones: .nebula-banner in next-ui.css.
  return (
    <section
      aria-label="Crash reports"
      data-nebula-crash-reports-banner
      className="nebula-banner"
      data-tone="info"
    >
      <div className="nebula-banner-row">
        <ShieldCheck className="nebula-banner-icon" aria-hidden="true" />
        <span className="nebula-banner-copy">
          Help fix crashes by sending anonymous crash reports. Off unless you choose Share.{' '}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            className="nebula-banner-link"
          >
            What's sent?
            <ChevronDown className={`h-3 w-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
        </span>
        <div className="nebula-banner-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(false)}
            className="nebula-banner-button"
            data-variant="quiet"
          >
            Not now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => answer(true)}
            className="nebula-banner-button"
            data-variant="primary"
          >
            Share
          </button>
        </div>
      </div>
      {showDetails && (
        <div className="pb-2 pl-[34px] pt-3">
          <CrashReportsDisclosure />
          <p className="mt-2 text-xs text-[var(--next-muted)]">You can change this any time in Settings → Desktop.</p>
        </div>
      )}
    </section>
  );
};
