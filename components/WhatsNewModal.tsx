import React, { useEffect, useState } from 'react';
import { ExternalLink, Gauge, Sparkles, Wrench, X, type LucideIcon } from 'lucide-react';
// Surface, header, footer and buttons come from the shared .nebula-modal / .nebula-control-button styles (next-ui.css).
import { APP_VERSION } from '../constants';
import { releaseUrlForVersion } from '../electron/releaseUrl';
import type { ReleaseChangeType, ReleaseNotes } from '../utils/releaseNotes';
import { loadReleaseNotes } from '../utils/releaseNotesLoader';

const SEEN_VERSION_KEY = 'nebula_version';

const SECTION_ICONS: Record<ReleaseChangeType, LucideIcon> = {
  feature: Sparkles,
  performance: Gauge,
  fix: Wrench,
};

const readSeenVersion = (): string | null => {
  try { return localStorage.getItem(SEEN_VERSION_KEY); } catch { return null; }
};

/**
 * Shows the running version's release notes (docs/release/v<version>.md) once
 * per version, grouped as Features, Performance and Bug fixes, matching the
 * GitHub release.
 */
export const WhatsNewModal: React.FC = () => {
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);

  useEffect(() => {
    if (readSeenVersion() === APP_VERSION) return;
    let cancelled = false;
    loadReleaseNotes(APP_VERSION)
      .then(loaded => { if (!cancelled) setNotes(loaded); })
      .catch(error => console.warn('Could not load release notes', error));
    return () => { cancelled = true; };
  }, []);

  const handleClose = () => {
    try { localStorage.setItem(SEEN_VERSION_KEY, APP_VERSION); } catch { /* storage unavailable */ }
    setNotes(null);
  };

  if (!notes) return null;

  const releaseUrl = releaseUrlForVersion(APP_VERSION);
  let itemIndex = 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="nebula-modal-scrim" onClick={handleClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="nebula-modal relative w-full max-w-lg max-h-[calc(100dvh-2rem)] animate-scale-in"
      >
        <div className="nebula-modal-header">
          <div className="nebula-modal-heading">
            <h2 id="whats-new-title" className="nebula-modal-title">What's New</h2>
            <p className="nebula-modal-subtitle">Version {APP_VERSION}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="nebula-modal-close"
            aria-label="Close what's new"
          >
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="nebula-modal-body custom-scrollbar max-h-[60vh] px-5 pb-6 pt-5">
          <h3 className="text-base font-bold text-[var(--next-text)]">{notes.title}</h3>
          <p className="mt-1 text-xs text-[var(--next-muted)]">Released {notes.date}</p>
          {notes.summary && (
            <p className="mt-4 text-sm leading-relaxed text-[var(--next-muted)]">{notes.summary}</p>
          )}
          <div className="mt-6 space-y-6">
            {notes.sections.map(section => {
              const Icon = SECTION_ICONS[section.type];
              return (
                <section key={section.type} aria-labelledby={`whats-new-${section.type}`} className="nebula-whats-new-section">
                  <h4 id={`whats-new-${section.type}`}>
                    <Icon aria-hidden="true" />
                    {section.heading}
                  </h4>
                  <ul className="space-y-2.5">
                    {section.items.map(item => {
                      itemIndex += 1;
                      return (
                        <li
                          key={item}
                          className={`flex items-start text-sm leading-relaxed text-[var(--next-text)] animate-slide-up stagger-${Math.min(itemIndex, 8)}`}
                        >
                          <span className="mr-3 mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>

        <div className="nebula-modal-footer">
          {releaseUrl && (
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="nebula-control-button"
              data-variant="quiet"
            >
              View full release notes
              <ExternalLink aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="nebula-control-button"
            data-variant="primary"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
