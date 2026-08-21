import { describe, expect, it, vi } from 'vitest';
import {
  MAX_DJ_OUTPUT_TOKENS,
  buildListeningSummary,
  buildMessages,
  createLlmClient,
  type LlmTransport,
} from './llmClient';

const fakeTransport = (overrides?: Partial<LlmTransport>): LlmTransport => ({
  postJson: vi.fn(async () => ({
    ok: true,
    status: 200,
    body: {
      choices: [{ message: { content: JSON.stringify({ speech: 'Hello', playlist: { queries: ['synthwave'] } }) } }],
    },
  })),
  ...overrides,
});

const config = {
  baseUrl: 'https://api.groq.com/openai/v1',
  model: 'openai/gpt-oss-20b',
  apiKey: 'sk-test-123',
};

const listening = {
  topTracks: [
    { title: 'Neon', artist: 'Chrome Waves' },
    { title: 'Midnight Drive', artist: 'Solar Fields' },
  ],
  topGenres: ['Synthwave', 'Electronic'],
};

describe('buildListeningSummary', () => {
  it('caps top tracks and genres to keep the prompt small', () => {
    const tracks = Array.from({ length: 25 }, (_, i) => ({ title: `Track ${i}`, artist: `Artist ${i}` }));
    const genres = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const summary = buildListeningSummary(tracks, genres);
    expect(summary.topTracks).toHaveLength(10);
    expect(summary.topGenres).toHaveLength(5);
    expect(summary.topTracks[0]).toEqual({ title: 'Track 0', artist: 'Artist 0' });
  });

  it('keeps only title and artist, never raw song fields', () => {
    const songs = [{ title: 'Neon', artist: 'Chrome Waves', duration: 200, path: '/secret/raw.mp3' } as never];
    const summary = buildListeningSummary(songs, []);
    expect(summary.topTracks[0]).toEqual({ title: 'Neon', artist: 'Chrome Waves' });
    expect(JSON.stringify(summary)).not.toContain('/secret/raw.mp3');
  });
});

describe('buildMessages', () => {
  it('builds a compact prompt that includes the listening summary', () => {
    const messages = buildMessages(listening);
    const user = messages.find((m) => m.role === 'user');
    expect(user?.content).toContain('Neon');
    expect(user?.content).toContain('Chrome Waves');
    expect(user?.content).toContain('Synthwave');
    expect(messages.some((m) => m.role === 'system')).toBe(true);
  });
});

describe('createLlmClient', () => {
  it('posts to the OpenAI-compatible chat completions endpoint with the key', async () => {
    const transport = fakeTransport();
    const client = createLlmClient(transport);
    await client.generateDjContent(listening, config);
    expect(transport.postJson).toHaveBeenCalledTimes(1);
    const [url, headers, body] = (transport.postJson as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      Record<string, string>,
      Record<string, unknown>,
    ];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(headers.Authorization).toBe('Bearer sk-test-123');
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.max_tokens).toBeLessThanOrEqual(MAX_DJ_OUTPUT_TOKENS);
    expect((body as { response_format?: { type: string } }).response_format).toEqual({ type: 'json_object' });
    expect((body.messages as { role: string }[]).length).toBeGreaterThanOrEqual(2);
  });

  it('parses a valid response into speech and playlist', async () => {
    const client = createLlmClient(fakeTransport());
    const result = await client.generateDjContent(listening, config);
    expect(result).toEqual({ speech: 'Hello', playlist: { queries: ['synthwave'] } });
  });

  it('parses JSON wrapped in markdown code fences', async () => {
    const transport = fakeTransport({
      postJson: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: {
          choices: [{ message: { content: '```json\n{"speech":"Yo","playlist":{"genres":["rock"]}}\n```' } }],
        },
      })),
    });
    const client = createLlmClient(transport);
    const result = await client.generateDjContent(listening, config);
    expect(result).toEqual({ speech: 'Yo', playlist: { genres: ['rock'] } });
  });

  it('throws on a non-OK HTTP response', async () => {
    const transport = fakeTransport({
      postJson: vi.fn(async () => ({ ok: false, status: 429, body: null })),
    });
    const client = createLlmClient(transport);
    await expect(client.generateDjContent(listening, config)).rejects.toThrow(/429/);
  });

  it('throws on a malformed/unparseable response without crashing', async () => {
    const transport = fakeTransport({
      postJson: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { choices: [{ message: { content: 'not json' } }] },
      })),
    });
    const client = createLlmClient(transport);
    await expect(client.generateDjContent(listening, config)).rejects.toThrow();
  });

  it('normalizes playlist criteria to non-empty arrays', async () => {
    const transport = fakeTransport({
      postJson: vi.fn(async () => ({
        ok: true,
        status: 200,
        body: {
          choices: [
            { message: { content: JSON.stringify({ speech: 'Hi', playlist: { queries: [], genres: ['pop'], seeds: [] } }) } },
          ],
        },
      })),
    });
    const client = createLlmClient(transport);
    const result = await client.generateDjContent(listening, config);
    expect(result.playlist).toEqual({ genres: ['pop'] });
  });
});
