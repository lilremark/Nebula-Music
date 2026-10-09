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
  onSessionStarted(): Promise<void>;
  getTrackCount(): number;
  reset(): void;
}

// Back-off tuning: after this many consecutive LLM failures, enter cooldown.
const FAILURE_THRESHOLD = 2;
// Cooldown length in intervals (interludes to skip) before retrying.
const COOLDOWN_INTERVALS = 2;

const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false;
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();
  // Covers 429 status, "rate limit", "rate-limit", "too many requests"
  return lower.includes('429') || lower.includes('rate limit') || lower.includes('rate-limit') || lower.includes('too many requests');
};

export const createDjOrchestrator = (deps: DjOrchestratorDeps): DjOrchestrator => {
  let trackCount = 0;
  let welcomeFired = false;
  let consecutiveFailures = 0;
  let cooldownRemaining = 0;

  const handleFailure = (error: unknown): void => {
    consecutiveFailures += 1;
    // Rate-limit errors trigger cooldown immediately to bound token use.
    if (isRateLimitError(error)) {
      cooldownRemaining = COOLDOWN_INTERVALS;
      return;
    }
    if (consecutiveFailures >= FAILURE_THRESHOLD) {
      cooldownRemaining = COOLDOWN_INTERVALS;
    }
  };

  const handleSuccess = (): void => {
    consecutiveFailures = 0;
    // Do not clear cooldownRemaining here; it is consumed interval-by-interval.
    // Success naturally occurs only when cooldown is 0, so this resets the failure streak.
  };

  const runDjTurn = async (config: DjConfig, apiKey: string): Promise<void> => {
    const listening = await deps.getListeningSummary();
    const response = await deps.llmClient.generateDjContent(listening, {
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey,
    });
    if (isEmptyCriteria(response.playlist)) {
      handleSuccess();
      return;
    }
    try {
      await deps.speech.speak(response.speech, config.voice);
    } catch {
      // Speech failure is non-fatal for the interlude.
    }
    const songs = await deps.resolver.resolve(response.playlist);
    if (songs.length > 0) deps.enqueue(songs);
    handleSuccess();
  };

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
      // Cooldown check: skip this interlude, consume one interval of cooldown.
      if (cooldownRemaining > 0) {
        cooldownRemaining -= 1;
        trackCount = 0;
        return;
      }
      trackCount = 0;
      try {
        await runDjTurn(config, apiKey);
      } catch (error) {
        handleFailure(error);
        // Silent skip — playback continues.
      }
    },

    async onSessionStarted(): Promise<void> {
      if (welcomeFired) return;
      welcomeFired = true;
      const config = deps.getConfig();
      if (!config.enabled) return;
      const apiKey = await deps.getApiKey();
      if (!apiKey) return;
      // Welcome is a single LLM call per session; it is not gated by cooldown
      // so a new session still greets the user even after prior back-off.
      // Its failure still contributes to back-off for subsequent intervals.
      try {
        await runDjTurn(config, apiKey);
      } catch (error) {
        handleFailure(error);
        // Silent skip — playback continues without welcome.
      }
    },

    getTrackCount(): number {
      return trackCount;
    },

    reset(): void {
      trackCount = 0;
      welcomeFired = false;
      consecutiveFailures = 0;
      cooldownRemaining = 0;
    },
  };
};
