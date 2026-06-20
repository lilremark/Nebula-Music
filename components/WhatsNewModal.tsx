
import React, { useEffect, useState } from 'react';
import { Sparkles, X, Check, Rocket } from 'lucide-react';
import { APP_VERSION, CHANGELOG } from '../constants';

export const WhatsNewModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('nebula_version');
    if (lastSeenVersion !== APP_VERSION) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('nebula_version', APP_VERSION);
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const currentLog = CHANGELOG[0]; // Get the latest changelog

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-neutral-900/40 dark:bg-neutral-950/80 backdrop-blur-xs"
        onClick={handleClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">

        {/* Header */}
        <div className="relative p-8 pb-6 overflow-hidden border-b border-neutral-200 dark:border-white/5 bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-800/50 dark:to-neutral-900/50">
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
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">What's New</h2>
            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200 dark:bg-white/5 dark:border-white/10">
              <span className="text-primary font-mono text-[10px] font-bold uppercase tracking-wider">
                Version {APP_VERSION}
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 pt-6 flex-1 max-h-[60vh] overflow-y-auto custom-scrollbar bg-neutral-50 dark:bg-neutral-900/50">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-white mb-6 flex items-center justify-center">
            {currentLog.title}
          </h3>
          <p className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400 text-center mb-6">
            Released {currentLog.date}
          </p>
          <ul className="space-y-4">
            {currentLog.changes.map((change, index) => (
              <li
                key={index}
                className={`flex items-start text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed animate-slide-up stagger-${Math.min(index + 1, 8)}`}
              >
                <div className="mt-1 min-w-[18px] h-[18px] rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 mr-3 shrink-0">
                  <Check className="w-2.5 h-2.5 text-primary" />
                </div>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-neutral-200 dark:border-white/5 bg-neutral-50 dark:bg-neutral-900">
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
