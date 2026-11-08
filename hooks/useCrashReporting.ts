import { useCallback, useEffect, useState } from 'react';
import { usePlatform } from '../platform/PlatformContext';
import type { CrashReportingState } from '../electron/crashProtocol';

// One copy of the consent state per page, so the first-run banner and the
// Settings toggle always agree after either one changes it.
let current: CrashReportingState | null = null;
const listeners = new Set<(state: CrashReportingState) => void>();

const publish = (state: CrashReportingState): void => {
  current = state;
  for (const listener of listeners) listener(state);
};

/** Crash-report availability and consent; `state` stays null in the web build. */
export const useCrashReporting = () => {
  const platform = usePlatform();
  const [state, setState] = useState<CrashReportingState | null>(current);

  useEffect(() => {
    if (!platform || platform.info.kind !== 'desktop') return;
    listeners.add(setState);
    if (current) setState(current);
    else platform.diagnostics.getCrashReporting().then(publish).catch(() => {});
    return () => { listeners.delete(setState); };
  }, [platform]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!platform) return;
    publish(await platform.diagnostics.setCrashReporting(enabled));
  }, [platform]);

  return { state, setEnabled };
};

/** Test hook: forgets the cached state between tests. */
export const resetCrashReportingStateForTests = (): void => {
  current = null;
  listeners.clear();
};
