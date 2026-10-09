export const MAX_DJ_OUTPUT_TOKENS = 400;

export interface ListeningSummary {
  topTracks: { title: string; artist: string }[];
  topGenres: string[];
}

export interface PlaylistCriteria {
  queries?: string[];
  genres?: string[];
  seeds?: string[];
}

export interface DjResponse {
  speech: string;
  playlist: PlaylistCriteria;
}

export interface LlmConfig {
  baseUrl: string;
  model: string;
  apiKey: string;
}

export interface LlmTransport {
  postJson(
    url: string,
    headers: Record<string, string>,
    body: unknown,
  ): Promise<{ ok: boolean; status: number; body: unknown }>;
}

export interface LlmClient {
  generateDjContent(listening: ListeningSummary, config: LlmConfig): Promise<DjResponse>;
}

export class LlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmError';
  }
}

const SYSTEM_PROMPT =
  'You are Nebula\'s AI DJ. Turn the listener\'s recent taste into a short spoken line and a compact playlist. Reply with ONLY JSON of the form {"speech":"<1-2 sentences>","playlist":{"queries":["<1-3 short Subsonic search terms>"],"genres":["<0-2 genres>"],"seeds":["<0-2 artist or song seeds>"]}}. Keep queries short and concrete. Omit empty arrays.';

export const buildListeningSummary = (
  songs: { title: string; artist: string }[],
  genres: string[],
): ListeningSummary => ({
  topTracks: songs.slice(0, 10).map((s) => ({ title: s.title, artist: s.artist })),
  topGenres: genres.slice(0, 5),
});

export const buildMessages = (
  listening: ListeningSummary,
): { role: 'system' | 'user'; content: string }[] => {
  const trackLines = listening.topTracks.map((t) => `- ${t.artist} - ${t.title}`).join('\n');
  const genreLine = listening.topGenres.length ? `Top genres: ${listening.topGenres.join(', ')}` : '';
  const userContent = [
    "Listener's most-played tracks:",
    trackLines || '(none yet)',
    genreLine,
    '',
    'Write a brief DJ line and pick playlist criteria that fit this taste.',
  ]
    .filter(Boolean)
    .join('\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
};

const stripCodeFences = (text: string): string => {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1].trim() : trimmed;
};

const extractContent = (body: unknown): string | null => {
  if (!body || typeof body !== 'object') return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const content = (choices[0] as { message?: { content?: unknown } })?.message?.content;
  return typeof content === 'string' ? content : null;
};

const normalizePlaylist = (raw: unknown): PlaylistCriteria => {
  if (!raw || typeof raw !== 'object') return {};
  const out: PlaylistCriteria = {};
  const rec = raw as Record<string, unknown>;
  for (const key of ['queries', 'genres', 'seeds'] as const) {
    const arr = rec[key];
    if (Array.isArray(arr)) {
      const filtered = arr.filter((v) => typeof v === 'string' && v.trim().length > 0).map((v) => (v as string).trim());
      if (filtered.length > 0) out[key] = filtered;
    }
  }
  return out;
};

const parseDjResponse = (content: string): DjResponse | null => {
  const stripped = stripCodeFences(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  if (typeof rec.speech !== 'string' || rec.speech.trim().length === 0) return null;
  return {
    speech: rec.speech.trim(),
    playlist: normalizePlaylist(rec.playlist),
  };
};

export const createLlmClient = (transport: LlmTransport): LlmClient => ({
  async generateDjContent(listening, config) {
    const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const messages = buildMessages(listening);
    const response = await transport.postJson(
      url,
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      {
        model: config.model,
        max_tokens: MAX_DJ_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
        messages,
      },
    );
    if (!response.ok) {
      throw new LlmError(`LLM request failed (${response.status}).`);
    }
    const content = extractContent(response.body);
    if (content === null) throw new LlmError('LLM response had no content.');
    const parsed = parseDjResponse(content);
    if (!parsed) throw new LlmError('LLM response was not valid JSON.');
    return parsed;
  },
});
