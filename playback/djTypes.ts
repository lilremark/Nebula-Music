import type { ISong } from '../types';
export interface DjLocalSettings { interval: 4 | 5; voice: 'Michael' | 'Heart'; style: 'standalone' | 'over-music'; discovery: 'familiar' | 'balanced' | 'discover'; voiceLevel: number; showTranscript: boolean }
export const DEFAULT_LOCAL_DJ: DjLocalSettings = { interval: 5, voice: 'Michael', style: 'standalone', discovery: 'balanced', voiceLevel: 0.85, showTranscript: true };
export interface ListeningEvent { id: string; profile: string; song: ISong; at: number; listened: number; qualified: boolean; completed: boolean; skipped: boolean }
export interface DjSessionState {
  active: boolean; phase: 'idle' | 'preparing' | 'playing' | 'speaking' | 'paused';
  preparingNext: boolean; completed: number; upcoming: ISong[]; transcript: string; taste: string; error?: string;
}
export const EMPTY_DJ: DjSessionState = { active: false, phase: 'idle', preparingNext: false, completed: 0, upcoming: [], transcript: '', taste: '' };

export interface DjPresentation {
  sessionId: string | null;
  active: boolean;
  speech: boolean;
  preview: boolean;
  playing: boolean;
  position: number;
  duration: number;
}
