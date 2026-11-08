// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installCrashForwarding, reportRendererError, resetCrashForwardingForTests } from './crashForwarding';

const report = vi.fn();

beforeEach(() => {
  resetCrashForwardingForTests();
  report.mockReset();
  (window as unknown as { desktop: unknown }).desktop = { diagnostics: { report } };
});

afterEach(() => {
  delete (window as unknown as { desktop?: unknown }).desktop;
});

describe('reportRendererError', () => {
  it('forwards an Error with name, stack, component stack and view', () => {
    const error = new TypeError('bad');
    reportRendererError('view-boundary', error, { componentStack: '\n at Library', view: 'ALBUM_DETAIL' });
    expect(report).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'view-boundary',
      name: 'TypeError',
      message: 'bad',
      componentStack: '\n at Library',
      view: 'ALBUM_DETAIL',
    }));
    expect(report.mock.calls[0]![0].stack).toContain('TypeError: bad');
  });

  it('is a no-op in the web build', () => {
    delete (window as unknown as { desktop?: unknown }).desktop;
    expect(() => reportRendererError('boundary', new Error('x'))).not.toThrow();
    expect(report).not.toHaveBeenCalled();
  });

  it('truncates oversized fields so the main-process schema accepts them', () => {
    const error = new Error('m'.repeat(10_000));
    error.stack = 's'.repeat(100_000);
    reportRendererError('boundary', error);
    const sent = report.mock.calls[0]![0];
    expect(sent.message).toHaveLength(4096);
    expect(sent.stack).toHaveLength(32 * 1024);
  });

  it('drops invalid view names, browser noise, and stops after 20 reports', () => {
    reportRendererError('boundary', new Error('x'), { view: '../../etc' });
    expect(report.mock.calls[0]![0].view).toBeUndefined();
    reportRendererError('window-error', 'ResizeObserver loop completed with undelivered notifications.');
    expect(report).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 30; i += 1) reportRendererError('window-error', new Error(`e${i}`));
    expect(report).toHaveBeenCalledTimes(20);
  });

  it('never throws when the bridge throws', () => {
    report.mockImplementation(() => { throw new Error('ipc closed'); });
    expect(() => reportRendererError('boundary', new Error('x'))).not.toThrow();
  });
});

describe('installCrashForwarding', () => {
  it('forwards uncaught errors and unhandled rejections', () => {
    installCrashForwarding();
    window.dispatchEvent(new ErrorEvent('error', { error: new Error('uncaught'), message: 'uncaught' }));
    const rejection = new Event('unhandledrejection') as Event & { reason: unknown };
    rejection.reason = new Error('rejected');
    window.dispatchEvent(rejection);
    expect(report.mock.calls.map((call) => [call[0].kind, call[0].message])).toEqual([
      ['window-error', 'uncaught'],
      ['unhandled-rejection', 'rejected'],
    ]);
  });
});
