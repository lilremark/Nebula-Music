import React, { useEffect, useState } from 'react';
import { ExternalLink, Gauge, Sparkles, Wrench, X, type LucideIcon } from 'lucide-react';
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
      <div
        className="absolute inset-0 bg-neutral-900/40 dark:bg-neutral-950/80 backdrop-blur-xs"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whats-new-title"
        className="relative w-full max-w-lg max-h-[calc(100dvh-2rem)] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in"
      >

        {/* Header */}
        <div className="relative p-8 pb-6 shrink-0 overflow-hidden border-b border-neutral-200 dark:border-white/5 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-900/50">
          <div className="absolute inset-0 bg-grid-white/[0.02] dark:bg-grid-white/[0.02] bg-[length:20px_20px]" />

          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-white/5 transition-colors z-10"
            aria-label="Close what's new"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 border border-primary/20">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h2 id="whats-new-title" className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">What's New</h2>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 dark:bg-white/5 dark:border-white/10">
              <span className="text-primary font-mono text-[10px] font-bold uppercase tracking-wider">
                Version {APP_VERSION}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 flex-1 min-h-0 max-h-[60vh] overflow-y-auto custom-scrollbar bg-neutral-50 dark:bg-neutral-900/50">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-2 text-center">
            {notes.title}
          </h3>
          <p className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 text-center mb-6">
            Released {notes.date}
          </p>
          {notes.summary && (
            <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed mb-6">{notes.summary}</p>
          )}
          <div className="space-y-6">
            {notes.sections.map(section => {
              const Icon = SECTION_ICONS[section.type];
              return (
                <section key={section.type} aria-labelledby={`whats-new-${section.type}`}>
                  <h4
                    id={`whats-new-${section.type}`}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3"
                  >
                    <Icon className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                    {section.heading}
                  </h4>
                  <ul className="space-y-3">
                    {section.items.map(item => {
                      itemIndex += 1;
                      return (
                        <li
                          key={item}
                          className={`flex items-start text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed animate-slide-up stagger-${Math.min(itemIndex, 8)}`}
                        >
                          <span className="mt-2 mr-3 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" aria-hidden="true" />
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

        {/* Footer */}
        <div className="p-6 shrink-0 border-t border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-neutral-900 space-y-3">
          {releaseUrl && (
            <a
              href={releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-lg hover:brightness-110 transition-all flex items-center justify-center gap-2"
            >
              View full release notes
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
          <button
            onClick={handleClose}
            className="w-full py-3 bg-neutral-900 text-white font-semibold rounded-lg hover:bg-neutral-800 transition-colors dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
