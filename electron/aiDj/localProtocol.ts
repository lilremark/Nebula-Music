import { z } from 'zod';

export const djTrackSchema = z.object({ id: z.string().min(1).max(256), title: z.string().max(256), artist: z.string().max(256), genre: z.string().max(128).optional() });
export const djPrepareSchema = z.object({
  requestId: z.string().uuid(), sessionId: z.string().uuid(),
  tracks: z.array(djTrackSchema).min(1).max(5),
  taste: z.string().max(1200), welcome: z.boolean(),
  voice: z.enum(['Michael', 'Heart']),
});
export type DjPrepareRequest = z.infer<typeof djPrepareSchema>;
export interface DjPreparedAudio { requestId: string; sessionId: string; text: string; wavBase64: string; fallback: boolean; error?: string }
export interface DjReadiness { ready: boolean; error?: string }
export interface DjModelStatus { phase: 'missing' | 'downloading' | 'installing' | 'ready' | 'error'; ready: boolean; received: number; total: number; file?: string; error?: string }
export interface LocalDjApi {
  readiness(): Promise<DjReadiness>;
  prepare(request: DjPrepareRequest): Promise<DjPreparedAudio>;
  preview(voice: 'Michael' | 'Heart'): Promise<DjPreparedAudio>;
  cancel(): Promise<void>;
  modelsStatus(): Promise<DjModelStatus>;
  downloadModels(): Promise<DjModelStatus>;
  cancelDownload(): Promise<void>;
  onModelsStatus(handler: (state: DjModelStatus) => void): () => void;
}

export function fallbackCommentary(request: DjPrepareRequest): string {
  const track = request.tracks[0];
  const introduction = request.welcome ? 'Welcome to your Nebula DJ session.' : 'Here comes your next set.';
  const label = (value: string) => value.replace(/https?:\S+/gi, '').replace(/[.!?\r\n]/g, ' ').trim();
  return introduction + ' Starting with ' + label(track.title).slice(0, 90) + ' by ' + label(track.artist).slice(0, 80) + '.';
}

// Bound the model's vocabulary to complete, grounded introductions. A 3B
// model can invent artists even with a grounding prompt; schema-enforced
// choices keep every name and listening claim tied to verified context.
export function groundedCommentaryChoices(request: DjPrepareRequest): string[] {
  const first = request.tracks[0];
  const clean = (value: string, length: number) => value.replace(/[.!?\r\n]/g, ' ').replace(/https?:\S+/gi, '').trim().slice(0, length);
  const track = clean(first.title, 70); const artist = clean(first.artist, 60);
  const learning = request.taste.startsWith('Still learning');
  const context = learning ? "I'm still learning your taste, so there's room to explore as you listen." : "Your listening history and likes help shape the mix, with room for familiar tracks and related discoveries.";
  const starts = request.welcome
    ? ['Welcome to your Nebula DJ session', 'Welcome, your personal mix is ready', "Let's start your Nebula DJ session"]
    : ["Let's settle into the next set", 'Your next set is ready', "Let's keep your mix moving"];
  return starts.map(start => `${start}, beginning with ${track} by ${artist}. ${context}`);
}

export function parseLocalCommentary(body: unknown, allowed?: string[]): string {
  const content = (body as { choices?: { message?: { content?: string } }[] })?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('The local DJ returned no commentary.');
  const result = JSON.parse(content);
  const text = z.string().trim().min(1).max(360).parse(result.speech);
  if (/<\/?think>|https?:|\{|\b(classic|legendary|influential|released|born|award|masterpiece)\b/i.test(text) || text.split(/(?<=[.!?])\s+/).length > 2) throw new Error('The local DJ returned unsuitable commentary.');
  if (allowed && !allowed.includes(text)) throw new Error('Commentary was not grounded in this set.');
  return text;
}
