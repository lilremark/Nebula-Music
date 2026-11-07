// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsNewModal } from './WhatsNewModal';
import { APP_VERSION } from '../constants';
import { loadReleaseNotes } from '../utils/releaseNotesLoader';

vi.mock('../utils/releaseNotesLoader', () => ({ loadReleaseNotes: vi.fn() }));

const sampleNotes = {
  version: APP_VERSION,
  date: '2026-11-06',
  title: 'Lighter Nebula',
  summary: 'Less work in the background.',
  body: '',
  sections: [
    { type: 'performance' as const, heading: 'Performance', items: ['Pause animations in the tray.'] },
    { type: 'fix' as const, heading: 'Bug fixes', items: ['Fix hidden-window animations.'] },
  ],
};

describe('WhatsNewModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    localStorage.clear();
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

  it('shows the release notes grouped by change type once per version', async () => {
    vi.mocked(loadReleaseNotes).mockResolvedValue(sampleNotes);
    await act(async () => root.render(<WhatsNewModal />));

    expect(loadReleaseNotes).toHaveBeenCalledWith(APP_VERSION);
    const headings = [...container.querySelectorAll('h4')].map(h => h.textContent);
    expect(headings).toEqual(['Performance', 'Bug fixes']);
    expect(container.textContent).toContain('Lighter Nebula');
    expect(container.textContent).toContain('Pause animations in the tray.');
    expect(container.querySelector('a')?.getAttribute('href')).toBe(
      `https://github.com/lilremark/Nebula-Music/releases/tag/v${APP_VERSION}`,
    );

    const gotIt = [...container.querySelectorAll('button')].find(b => b.textContent === 'Got it')!;
    await act(async () => gotIt.click());
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem('nebula_version')).toBe(APP_VERSION);
  });

  it('stays closed when the version was already seen or has no notes', async () => {
    localStorage.setItem('nebula_version', APP_VERSION);
    await act(async () => root.render(<WhatsNewModal />));
    expect(loadReleaseNotes).not.toHaveBeenCalled();

    localStorage.clear();
    vi.mocked(loadReleaseNotes).mockResolvedValue(null);
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<WhatsNewModal />));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});
