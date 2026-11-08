import type { ElectronMainOptions, ErrorEvent } from '@sentry/electron/main';
import type { CrashReportConsent, CrashReportingState, RendererErrorReport } from './crashProtocol';
import { scrubEvent, type ScrubContext } from './crashScrub';

/**
 * Opt-in anonymous crash reporting for the main process.
 *
 * The Sentry SDK is loaded and initialized only after the user opts in, so a
 * user who never opts in never runs it. Opting out after that turns `beforeSend`
 * into a drop-everything gate (the SDK cannot be cleanly re-initialized within
 * one process); the next launch does not load it at all.
 *
 * The SDK runs with no default integrations, no breadcrumbs, no sessions, no
 * minidumps and no IPC of its own. Renderer errors arrive over the app's typed
 * bridge (`reportRendererError`); renderer and child-process crashes arrive as
 * Electron `*-process-gone` metadata (`reportProcessGone`).
 */

type SentryMain = typeof import('./sentryMain');

export interface CrashReportingSettings {
  get(key: 'crashReports'): CrashReportConsent | undefined;
  get(key: 'crashReportsInstallId'): string | null | undefined;
  set(key: 'crashReports' | 'crashReportsInstallId', value: unknown): Promise<void>;
}

export interface CrashReportingDeps {
  /** Empty in builds without a DSN, which makes the feature unavailable. */
  dsn: string;
  version: string;
  isPackaged: boolean;
  homeDir: string;
  /** OS name and version only, e.g. { name: 'Windows', version: '10.0.26200' }. */
  os: { name: string; version: string };
  settings: CrashReportingSettings;
  loadSentry: () => Promise<SentryMain>;
  randomUUID: () => string;
}

export type ProcessGoneReason =
  | 'clean-exit' | 'abnormal-exit' | 'killed' | 'crashed' | 'oom'
  | 'launch-failed' | 'integrity-failure' | 'memory-eviction';

/** Reasons that indicate a fault; `clean-exit`, `killed` and `memory-eviction` are normal lifecycle. */
const REPORTED_EXIT_REASONS = new Set<ProcessGoneReason>([
  'crashed', 'oom', 'abnormal-exit', 'launch-failed', 'integrity-failure',
]);

/** Caps keep a crash loop from flooding the quota or the network. */
const MAX_EVENTS_PER_SESSION = 50;
const MAX_RENDERER_REPORTS_PER_SESSION = 20;

export const crashEnvironment = (version: string, isPackaged: boolean): 'beta' | 'stable' | 'development' => {
  if (!isPackaged) return 'development';
  return /-beta\.\d+$/.test(version) ? 'beta' : 'stable';
};

export interface CrashReporting {
  getState(): CrashReportingState;
  /** Starts reporting at launch when the user opted in earlier. */
  start(): Promise<void>;
  setConsent(enabled: boolean): Promise<CrashReportingState>;
  reportRendererError(report: RendererErrorReport, windowName: 'main' | 'mini-player'): void;
  reportProcessGone(details: { process: string; reason: ProcessGoneReason; exitCode: number }): void;
}

export const createCrashReporting = (deps: CrashReportingDeps): CrashReporting => {
  const scrubContext: ScrubContext = { homeDir: deps.homeDir };
  const available = deps.dsn.length > 0;
  let sentry: SentryMain | null = null;
  let loading: Promise<void> | null = null;
  let active = false;
  let eventsSent = 0;
  let rendererReports = 0;
  const seenRendererErrors = new Set<string>();

  const consent = (): CrashReportConsent => deps.settings.get('crashReports') ?? 'unset';

  const beforeSend = (event: ErrorEvent): ErrorEvent | null => {
    if (!active || eventsSent >= MAX_EVENTS_PER_SESSION) return null;
    eventsSent += 1;
    // Node's context integration (which would add OS and much more) is not
    // enabled, so the OS is added here, and only its name and version.
    return scrubEvent({ ...event, contexts: { ...event.contexts, os: { ...deps.os } } }, scrubContext);
  };

  const initSentry = async (): Promise<void> => {
    const mod = await deps.loadSentry();
    const options: ElectronMainOptions = {
      dsn: deps.dsn,
      release: `nebula@${deps.version}`,
      environment: crashEnvironment(deps.version, deps.isPackaged),
      dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
      // Renderer errors use the app's validated bridge instead of Sentry's own
      // IPC channels and `sentry-ipc://` protocol. 0 registers neither.
      ipcMode: 0 as ElectronMainOptions['ipcMode'],
      defaultIntegrations: false,
      integrations: [
        mod.electronContextIntegration(),
        mod.onUncaughtExceptionIntegration(),
        // Electron's main process only warns on unhandled rejections; 'warn' keeps that.
        mod.onUnhandledRejectionIntegration({ mode: 'warn' }),
        mod.linkedErrorsIntegration(),
        mod.dedupeIntegration(),
        mod.functionToStringIntegration(),
        mod.eventFiltersIntegration(),
        // Rewrites install paths (which contain the user name) to app:///.
        mod.normalizePathsIntegration(),
      ],
      transport: mod.makeElectronTransport,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      sendClientReports: false,
      beforeSend,
    };
    mod.init(options);
    sentry = mod;
  };

  const activate = async (installId: string | null): Promise<void> => {
    if (!available) return;
    if (!sentry) {
      loading ??= initSentry().finally(() => { loading = null; });
      await loading;
    }
    active = true;
    sentry?.setUser(installId ? { id: installId } : null);
  };

  const deactivate = (): void => {
    active = false;
    sentry?.setUser(null);
  };

  return {
    getState: () => ({ available, consent: consent() }),

    start: async () => {
      if (!available || consent() !== 'enabled') return;
      try {
        await activate(deps.settings.get('crashReportsInstallId') ?? null);
      } catch (error) {
        console.warn('[nebula] crash reporting failed to start', error);
      }
    },

    setConsent: async (enabled) => {
      if (enabled) {
        const installId = deps.settings.get('crashReportsInstallId') ?? deps.randomUUID();
        await deps.settings.set('crashReportsInstallId', installId);
        await deps.settings.set('crashReports', 'enabled');
        try {
          await activate(installId);
        } catch (error) {
          console.warn('[nebula] crash reporting failed to start', error);
        }
      } else {
        deactivate();
        await deps.settings.set('crashReports', 'disabled');
        await deps.settings.set('crashReportsInstallId', null);
      }
      return { available, consent: consent() };
    },

    reportRendererError: (report, windowName) => {
      if (!active || !sentry || rendererReports >= MAX_RENDERER_REPORTS_PER_SESSION) return;
      const firstFrame = report.stack?.split('\n').find((line) => line.trim().startsWith('at ')) ?? '';
      const key = `${report.kind}|${report.message}|${firstFrame}`;
      if (seenRendererErrors.has(key)) return;
      seenRendererErrors.add(key);
      rendererReports += 1;

      const error = new Error(report.message);
      error.name = report.name || 'Error';
      error.stack = report.stack || `${error.name}: ${report.message}`;
      sentry.captureException(error, {
        // Every forwarded renderer error escaped the code that raised it.
        mechanism: { type: `nebula.renderer.${report.kind}`, handled: false },
        captureContext: {
          level: report.kind === 'boundary' ? 'fatal' : 'error',
          tags: {
            'event.process': 'renderer',
            'nebula.window': windowName,
            'nebula.kind': report.kind,
            ...(report.view ? { 'nebula.view': report.view } : {}),
          },
          extra: report.componentStack ? { componentStack: report.componentStack } : undefined,
        },
      });
    },

    reportProcessGone: ({ process, reason, exitCode }) => {
      if (!active || !sentry || !REPORTED_EXIT_REASONS.has(reason)) return;
      sentry.captureMessage(`${process} process gone: ${reason}`, {
        level: reason === 'abnormal-exit' ? 'error' : 'fatal',
        tags: { 'nebula.process': process, 'nebula.reason': reason },
        extra: { exitCode, reason, processType: process },
        fingerprint: ['process-gone', process, reason],
      });
    },
  };
};
