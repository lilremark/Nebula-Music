// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CrashReportingState } from '../electron/crashProtocol';
import { resetCrashReportingStateForTests } from '../hooks/useCrashReporting';
import { CrashReportsBanner } from './CrashReportsBanner';

const diagnostics = {
  getCrashReporting: vi.fn<() => Promise<CrashReportingState>>(),
  setCrashReporting: vi.fn<(enabled: boolean) => Promise<CrashReportingState>>(),
};
let platformKind: 'desktop' | 'web' = 'desktop';

vi.mock('../platform/PlatformContext', () => ({
  usePlatform: () => ({ info: { kind: platformKind }, diagnostics }),
}));

const buttonByText = (container: HTMLElement, text: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(text));

describe('CrashReportsBanner', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    resetCrashReportingStateForTests();
    platformKind = 'desktop';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  const render = async () => { await act(async () => root.render(<CrashReportsBanner />)); };

  it('asks once when reporting is available and the user has not answered', async () => {
    diagnostics.getCrashReporting.mockResolvedValue({ available: true, consent: 'unset' });
    await render();
    expect(container.querySelector('[data-nebula-crash-reports-banner]')).not.toBeNull();
  });

  it.each([
    { available: false, consent: 'unset' as const },
    { available: true, consent: 'enabled' as const },
    { available: true, consent: 'disabled' as const },
  ])('stays hidden for %o', async (state) => {
    diagnostics.getCrashReporting.mockResolvedValue(state);
    await render();
    expect(container.querySelector('[data-nebula-crash-reports-banner]')).toBeNull();
  });

  it('stays hidden in the web build', async () => {
    platformKind = 'web';
    await render();
    expect(diagnostics.getCrashReporting).not.toHaveBeenCalled();
    expect(container.innerHTML).toBe('');
  });

  it.each([
    ['Share', true, 'enabled'],
    ['Not now', false, 'disabled'],
  ] as const)('%s records the answer and hides the banner', async (label, enabled, consent) => {
    diagnostics.getCrashReporting.mockResolvedValue({ available: true, consent: 'unset' });
    diagnostics.setCrashReporting.mockResolvedValue({ available: true, consent });
    await render();
    await act(async () => buttonByText(container, label)!.click());
    expect(diagnostics.setCrashReporting).toHaveBeenCalledWith(enabled);
    expect(container.querySelector('[data-nebula-crash-reports-banner]')).toBeNull();
  });

  it('explains what is and is not sent on request', async () => {
    diagnostics.getCrashReporting.mockResolvedValue({ available: true, consent: 'unset' });
    await render();
    expect(container.textContent).not.toContain('Never sent');
    await act(async () => buttonByText(container, "What's sent?")!.click());
    expect(container.textContent).toContain('Never sent');
    expect(container.textContent).toContain('server address');
  });
});
