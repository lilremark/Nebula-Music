import type { ListeningSummary, PlaylistCriteria, LlmConfig } from './llmClient';
import type { ISong } from '../../types';

export interface DjConfig {
  enabled: boolean;
  interval: number;
  provider: string;
  model: string;
  baseUrl: string;
  voice: string;
}

const isEmptyCriteria = (c: PlaylistCriteria): boolean =>
  (!c.queries || c.queries.length === 0) &&
  (!c.genres || c.genres.length === 0) &&
  (!c.seeds || c.seeds.length === 0);

export interface DjOrchestratorDeps {
  getConfig: () => DjConfig;
  getApiKey: () => Promise<string | null>;
  getListeningSummary: () => Promise<ListeningSummary>;
  llmClient: { generateDjContent(listening: ListeningSummary, config: LlmConfig): Promise<{ speech: string; playlist: PlaylistCriteria }> };
  speech: { speak(text: string, voiceId?: string): Promise<void> };
  resolver: { resolve(criteria: PlaylistCriteria): Promise<ISong[]> };
  enqueue: (songs: ISong[]) => void;
}

export interface DjOrchestrator {
  onTrackCompleted(): Promise<void>;
  getTrackCount(): number;
  reset(): void;
}

export const createDjOrchestrator = (deps: DjOrchestratorDeps): DjOrchestrator => {
  let trackCount = 0;

  return {
    async onTrackCompleted(): Promise<void> {
      trackCount += 1;
      const config = deps.getConfig();
      if (trackCount < config.interval) return;
      if (!config.enabled) {
        trackCount = 0;
        return;
      }
      const apiKey = await deps.getApiKey();
      if (!apiKey) {
        trackCount = 0;
        return;
      }
      trackCount = 0;
      try {
        const listening = await deps.getListeningSummary();
        const response = await deps.llmClient.generateDjContent(listening, {
          baseUrl: config.baseUrl,
          model: config.model,
          apiKey,
        });
        if (isEmptyCriteria(response.playlist)) return;
        try {
          await deps.speech.speak(response.speech, config.voice);
        } catch {
          // Speech failure is non-fatal for the interlude.
        }
        const songs = await deps.resolver.resolve(response.playlist);
        if (songs.length > 0) deps.enqueue(songs);
      } catch {
        // Silent skip on any LLM/parse error — playback continues.
      }
    },

    getTrackCount(): number {
      return trackCount;
    },

    reset(): void {
      trackCount = 0;
    },
  };
};
