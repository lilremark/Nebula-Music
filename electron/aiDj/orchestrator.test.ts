import { describe, expect, it, vi } from 'vitest';
import { createDjOrchestrator, type DjOrchestratorDeps } from './orchestrator';
import type { ISong } from '../../types';

const song = (id: string): ISong =>
  ({
    id,
    title: `Title ${id}`,
    artist: `Artist ${id}`,
    album: 'Album',
    albumId: 'al1',
    coverArt: 'ca1',
    duration: 200,
  }) as unknown as ISong;

const listening = {
  topTracks: [{ title: 'Neon', artist: 'Chrome Waves' }],
  topGenres: ['Synthwave'],
};

const fakeDeps = (overrides?: Partial<DjOrchestratorDeps>): DjOrchestratorDeps => ({
  getConfig: () => ({ enabled: true, interval: 3, provider: 'groq', model: 'openai/gpt-oss-20b', baseUrl: 'https://api.groq.com/openai/v1', voice: 'en_US-ryan-high' }),
  getApiKey: async () => 'sk-test-key',
  getListeningSummary: async () => listening,
  llmClient: {
    generateDjContent: vi.fn(async () => ({ speech: 'Hello from the DJ', playlist: { queries: ['synthwave'] } })),
  } as unknown as DjOrchestratorDeps['llmClient'],
  speech: { speak: vi.fn(async () => {}) } as unknown as DjOrchestratorDeps['speech'],
  resolver: { resolve: vi.fn(async () => [song('1'), song('2')]) } as unknown as DjOrchestratorDeps['resolver'],
  enqueue: vi.fn(),
  ...overrides,
});

describe('DjOrchestrator cadence', () => {
  it('stays quiet before the interval and fires at the interval', async () => {
    const deps = fakeDeps();
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted(); // 1
    await dj.onTrackCompleted(); // 2
    expect(deps.llmClient.generateDjContent).not.toHaveBeenCalled();
    expect(deps.speech.speak).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
    await dj.onTrackCompleted(); // 3 -> fires
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(1);
    expect(deps.speech.speak).toHaveBeenCalledWith('Hello from the DJ', 'en_US-ryan-high');
    expect(deps.enqueue).toHaveBeenCalledWith([expect.objectContaining({ id: '1' }), expect.objectContaining({ id: '2' })]);
  });

  it('resets the count after an interlude so the next interval is respected', async () => {
    const deps = fakeDeps({ getConfig: () => ({ enabled: true, interval: 2, provider: 'groq', model: 'm', baseUrl: 'https://x', voice: 'en_US-ryan-high' }) });
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted(); // 1
    await dj.onTrackCompleted(); // 2 -> fires
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(1);
    await dj.onTrackCompleted(); // 1
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(1);
    await dj.onTrackCompleted(); // 2 -> fires again
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(2);
  });
});

describe('DjOrchestrator disabled / unconfigured', () => {
  it('does nothing when disabled', async () => {
    const deps = fakeDeps({ getConfig: () => ({ enabled: false, interval: 1, provider: 'groq', model: 'm', baseUrl: 'https://x', voice: 'en_US-ryan-high' }) });
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted();
    expect(deps.llmClient.generateDjContent).not.toHaveBeenCalled();
    expect(deps.speech.speak).not.toHaveBeenCalled();
  });

  it('does nothing when no API key is configured', async () => {
    const deps = fakeDeps({ getApiKey: async () => null });
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted(); // interval 3: need 3
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    expect(deps.llmClient.generateDjContent).not.toHaveBeenCalled();
  });
});

describe('DjOrchestrator failure handling', () => {
  it('silently skips an interlude when the LLM call fails and continues counting', async () => {
    const deps = fakeDeps({
      llmClient: { generateDjContent: vi.fn(async () => { throw new Error('LLM down'); }) } as unknown as DjOrchestratorDeps['llmClient'],
    });
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    await dj.onTrackCompleted(); // fires -> LLM throws
    expect(deps.speech.speak).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
    // After a failed interlude the count resets, so the next interval is respected (not immediate retry)
    await dj.onTrackCompleted(); // 1
    await dj.onTrackCompleted(); // 2
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(1); // still 1 (second batch not yet)
    await dj.onTrackCompleted(); // 3 -> tries again
    expect(deps.llmClient.generateDjContent).toHaveBeenCalledTimes(2);
  });

  it('still speaks when the resolver yields no tracks (no enqueue, but speech happened)', async () => {
    const deps = fakeDeps({
      resolver: { resolve: vi.fn(async () => []) } as unknown as DjOrchestratorDeps['resolver'],
    });
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    expect(deps.speech.speak).toHaveBeenCalledWith('Hello from the DJ', expect.any(String));
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});

describe('DjOrchestrator seam', () => {
  it('produces the expected line and refreshed queue on a successful interlude', async () => {
    const deps = fakeDeps();
    const dj = createDjOrchestrator(deps);
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    await dj.onTrackCompleted();
    expect(deps.speech.speak).toHaveBeenCalledWith('Hello from the DJ', 'en_US-ryan-high');
    expect(deps.resolver.resolve).toHaveBeenCalledWith({ queries: ['synthwave'] });
    expect(deps.enqueue).toHaveBeenCalledTimes(1);
    expect(dj.getTrackCount()).toBe(0);
  });
});
