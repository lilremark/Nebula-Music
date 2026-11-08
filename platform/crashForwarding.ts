import type { RendererErrorReport } from '../electron/crashProtocol';

/**
 * Forwards renderer errors to the main process for opt-in crash reporting.
 * The main process validates, scrubs and drops them unless the user opted in,
 * so nothing here decides what leaves the machine. This lives in the platform
 * layer because it reads `window.desktop` before `PlatformProvider` resolves,
 * and a crash during startup is the one most worth reporting. In the web build
 * `window.desktop` is absent and every call is a no-op.
 */

const MAX_REPORTS_PER_PAGE = 20;
const MAX_MESSAGE = 4096;
const MAX_STACK = 32 * 1024;
const VIEW_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
// Benign browser noise that is not an app fault.
const IGNORED_MESSAGES = [/ResizeObserver loop/i, /^Script error\.?$/];

let reportsSent = 0;
let installed = false;

const truncate = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);

export const reportRendererError = (
  kind: RendererErrorReport['kind'],
  error: unknown,
  details: { componentStack?: string | null; view?: string } = {},
): void => {
  const diagnostics = typeof window === 'undefined' ? undefined : window.desktop?.diagnostics;
  if (!diagnostics || reportsSent >= MAX_REPORTS_PER_PAGE) return;

  const asError = error instanceof Error ? error : null;
  const message = asError ? asError.message : typeof error === 'string' ? error : 'Non-Error value thrown';
  if (IGNORED_MESSAGES.some((pattern) => pattern.test(message))) return;

  const report: RendererErrorReport = {
    kind,
    message: truncate(message, MAX_MESSAGE),
    ...(asError?.name ? { name: truncate(asError.name, 200) } : {}),
    ...(asError?.stack ? { stack: truncate(asError.stack, MAX_STACK) } : {}),
    ...(details.componentStack ? { componentStack: truncate(details.componentStack, MAX_STACK) } : {}),
    ...(details.view && VIEW_PATTERN.test(details.view) ? { view: details.view } : {}),
  };
  reportsSent += 1;
  try {
    diagnostics.report(report);
  } catch {
    // Reporting must never throw into the code that is already failing.
  }
};

/** Installs global `error` and `unhandledrejection` forwarding once per page. */
export const installCrashForwarding = (): void => {
  if (installed || typeof window === 'undefined' || !window.desktop?.diagnostics) return;
  installed = true;
  window.addEventListener('error', (event) => {
    reportRendererError('window-error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportRendererError('unhandled-rejection', event.reason);
  });
};

/** Test hook: resets the per-page counters. */
export const resetCrashForwardingForTests = (): void => {
  reportsSent = 0;
  installed = false;
};
