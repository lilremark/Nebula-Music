import { describe, expect, it, vi } from 'vitest';
import type { ElectronMainOptions, ErrorEvent } from '@sentry/electron/main';
import { crashEnvironment, createCrashReporting, type CrashReportingDeps } from './crashReporting';

const INSTALL_ID = '6b0b9a5e-2f2e-4a0c-9c43-0d0f7f1b0a11';

const fakeSentry = () => {
  let options: ElectronMainOptions | undefined;
  const integration = (name: string) => () => ({ name });
  const mod = {
    init: vi.fn((o: ElectronMainOptions) => { options = o; }),
    setUser: vi.fn(),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    electronContextIntegration: integration('ElectronContext'),
    onUncaughtExceptionIntegration: integration('OnUncaughtException'),
    onUnhandledRejectionIntegration: integration('OnUnhandledRejection'),
    linkedErrorsIntegration: integration('LinkedErrors'),
    dedupeIntegration: integration('Dedupe'),
    functionToStringIntegration: integration('FunctionToString'),
    eventFiltersIntegration: integration('EventFilters'),
    normalizePathsIntegration: integration('NormalizePaths'),
    makeElectronTransport: vi.fn(),
  };
  return { mod, options: () => options! };
};

const setup = (overrides: Partial<CrashReportingDeps> = {}, stored: Record<string, unknown> = {}) => {
  const sentry = fakeSentry();
  const store: Record<string, unknown> = { crashReports: 'unset', crashReportsInstallId: null, ...stored };
  const loadSentry = vi.fn(async () => sentry.mod as never);
  const deps: CrashReportingDeps = {
    dsn: 'https://public@o1.ingest.us.sentry.io/2',
    version: '3.0.2-beta.2',
    isPackaged: true,
    homeDir: 'C:\\Users\\remvr',
    os: { name: 'Windows', version: '10.0.26200' },
    settings: {
      get: ((key: string) => store[key]) as CrashReportingDeps['settings']['get'],
      set: vi.fn(async (key: string, value: unknown) => { store[key] = value; }),
    },
    loadSentry,
    randomUUID: () => INSTALL_ID,
    ...overrides,
  };
  return { reporting: createCrashReporting(deps), sentry, store, loadSentry };
};

const errorEvent = (message: string): ErrorEvent => ({ type: undefined, message });

describe('crashEnvironment', () => {
  it('tags prerelease builds as beta, others as stable, and unpackaged runs as development', () => {
    expect(crashEnvironment('3.0.2-beta.2', true)).toBe('beta');
    expect(crashEnvironment('3.0.1', true)).toBe('stable');
    expect(crashEnvironment('3.0.2-beta.2', false)).toBe('development');
  });
});

describe('createCrashReporting', () => {
  it('is unavailable and never loads the SDK in builds without a DSN', async () => {
    const { reporting, loadSentry } = setup({ dsn: '' }, { crashReports: 'enabled', crashReportsInstallId: INSTALL_ID });
    expect(reporting.getState()).toEqual({ available: false, consent: 'enabled' });
    await reporting.start();
    await reporting.setConsent(true);
    expect(loadSentry).not.toHaveBeenCalled();
  });

  it('does not load the SDK at launch until the user opts in', async () => {
    for (const consent of ['unset', 'disabled']) {
      const { reporting, loadSentry } = setup({}, { crashReports: consent });
      await reporting.start();
      expect(loadSentry).not.toHaveBeenCalled();
    }
  });

  it('starts at launch with the stored install id when the user opted in earlier', async () => {
    const { reporting, sentry } = setup({}, { crashReports: 'enabled', crashReportsInstallId: INSTALL_ID });
    await reporting.start();
    expect(sentry.mod.init).toHaveBeenCalledTimes(1);
    expect(sentry.mod.setUser).toHaveBeenLastCalledWith({ id: INSTALL_ID });
    const options = sentry.options();
    expect(options.release).toBe('nebula@3.0.2-beta.2');
    expect(options.environment).toBe('beta');
    expect(options.defaultIntegrations).toBe(false);
    expect(options.ipcMode).toBe(0);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options.dataCollection).toMatchObject({ userInfo: false });
    expect((options.integrations as { name: string }[]).map((i) => i.name)).not.toContain('SentryMinidump');
  });

  it('opting in creates an install id, persists consent and starts without a restart', async () => {
    const { reporting, sentry, store } = setup();
    const state = await reporting.setConsent(true);
    expect(state).toEqual({ available: true, consent: 'enabled' });
    expect(store.crashReportsInstallId).toBe(INSTALL_ID);
    expect(sentry.mod.init).toHaveBeenCalledTimes(1);
    expect(sentry.options().beforeSend!(errorEvent('x'), {})).toMatchObject({ message: 'x' });
  });

  it('opting out clears the install id and drops every later event', async () => {
    const { reporting, sentry, store } = setup({}, { crashReports: 'enabled', crashReportsInstallId: INSTALL_ID });
    await reporting.start();
    const state = await reporting.setConsent(false);
    expect(state.consent).toBe('disabled');
    expect(store.crashReportsInstallId).toBeNull();
    expect(sentry.mod.setUser).toHaveBeenLastCalledWith(null);
    expect(sentry.options().beforeSend!(errorEvent('x'), {})).toBeNull();
    reporting.reportRendererError({ kind: 'boundary', message: 'boom' }, 'main');
    reporting.reportProcessGone({ process: 'renderer', reason: 'crashed', exitCode: 1 });
    expect(sentry.mod.captureException).not.toHaveBeenCalled();
    expect(sentry.mod.captureMessage).not.toHaveBeenCalled();
  });

  it('opting back in during the same session reuses the SDK with a new install id', async () => {
    const { reporting, sentry, store } = setup({ randomUUID: vi.fn().mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValueOnce('22222222-2222-4222-8222-222222222222') });
    await reporting.setConsent(true);
    await reporting.setConsent(false);
    await reporting.setConsent(true);
    expect(sentry.mod.init).toHaveBeenCalledTimes(1);
    expect(store.crashReportsInstallId).toBe('22222222-2222-4222-8222-222222222222');
    expect(sentry.options().beforeSend!(errorEvent('x'), {})).not.toBeNull();
  });

  it('scrubs events in beforeSend', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    const out = sentry.options().beforeSend!(errorEvent('GET https://music.example.com/rest/ping.view?u=a&p=b'), {}) as ErrorEvent;
    expect(out.message).toBe('GET https://<server>');
  });

  it('adds only the OS name and version as OS context', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    const event = { ...errorEvent('x'), contexts: { os: { name: 'Windows', version: '1', kernel_version: 'k', raw_description: 'host' } } };
    const out = sentry.options().beforeSend!(event, {}) as ErrorEvent;
    expect(out.contexts!.os).toEqual({ name: 'Windows', version: '10.0.26200' });
  });

  it('caps the number of events sent in one session', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    const send = sentry.options().beforeSend!;
    const results = Array.from({ length: 60 }, () => send(errorEvent('x'), {}));
    expect(results.filter(Boolean)).toHaveLength(50);
  });

  it('forwards renderer errors once each, tagged with window, kind and view', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    const report = {
      kind: 'view-boundary' as const,
      name: 'TypeError',
      message: "Cannot read properties of undefined (reading 'id')",
      stack: "TypeError: Cannot read properties of undefined (reading 'id')\n    at Library (app://nebula/assets/Library-x.js:1:2)",
      componentStack: '\n    at Library',
      view: 'library',
    };
    reporting.reportRendererError(report, 'main');
    reporting.reportRendererError(report, 'main');
    expect(sentry.mod.captureException).toHaveBeenCalledTimes(1);
    const [error, context] = sentry.mod.captureException.mock.calls[0]!;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).name).toBe('TypeError');
    expect((error as Error).stack).toContain('app://nebula/assets/Library-x.js');
    expect(context).toMatchObject({
      mechanism: { type: 'nebula.renderer.view-boundary', handled: false },
      captureContext: {
        level: 'error',
        tags: { 'event.process': 'renderer', 'nebula.window': 'main', 'nebula.kind': 'view-boundary', 'nebula.view': 'library' },
        extra: { componentStack: '\n    at Library' },
      },
    });
  });

  it('caps renderer reports per session', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    for (let i = 0; i < 30; i += 1) reporting.reportRendererError({ kind: 'window-error', message: `e${i}` }, 'main');
    expect(sentry.mod.captureException).toHaveBeenCalledTimes(20);
  });

  it('reports faulty process exits and ignores normal ones', async () => {
    const { reporting, sentry } = setup();
    await reporting.setConsent(true);
    reporting.reportProcessGone({ process: 'renderer', reason: 'clean-exit', exitCode: 0 });
    reporting.reportProcessGone({ process: 'GPU', reason: 'killed', exitCode: 1 });
    reporting.reportProcessGone({ process: 'renderer', reason: 'memory-eviction', exitCode: 0 });
    expect(sentry.mod.captureMessage).not.toHaveBeenCalled();
    reporting.reportProcessGone({ process: 'GPU', reason: 'crashed', exitCode: -1073741819 });
    expect(sentry.mod.captureMessage).toHaveBeenCalledWith('GPU process gone: crashed', expect.objectContaining({
      level: 'fatal',
      fingerprint: ['process-gone', 'GPU', 'crashed'],
      extra: { exitCode: -1073741819, reason: 'crashed', processType: 'GPU' },
    }));
  });

  it('keeps the app working when the SDK fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { reporting } = setup({ loadSentry: async () => { throw new Error('missing'); } });
    await expect(reporting.setConsent(true)).resolves.toEqual({ available: true, consent: 'enabled' });
    expect(() => reporting.reportRendererError({ kind: 'boundary', message: 'x' }, 'main')).not.toThrow();
    warn.mockRestore();
  });
});
