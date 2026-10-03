import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { LocalDjRuntime } from '../electron/aiDj/localRuntime';

const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => { if (new URL(String(input)).hostname !== '127.0.0.1') throw new Error('External model networking blocked by verification'); return originalFetch(input, init); };
process.env.NEBULA_DJ_VOICE_CACHE ||= path.join(os.tmpdir(), 'nebula-dj-empty-cache-' + randomUUID());
app.whenReady().then(async () => {
  const runtime = new LocalDjRuntime(process.env.NEBULA_DJ_RESOURCES || path.resolve('electron/aiDj/resources'), process.env.NEBULA_DJ_WORKER || path.resolve('electron/dist/voiceWorker.cjs'), process.env.NEBULA_DJ_HELPER_RESOURCES || path.resolve('electron/aiDj/resources'));
  const count = Number(process.env.NEBULA_DJ_CASES || 1);
  const report: { index: number; seconds: number; text: string; fallback: boolean; error?: string }[] = [];
  try {
    const readiness = await runtime.readiness(); if (!readiness.ready) throw new Error(readiness.error);
    for (let index = 0; index < count; index++) {
      const started = Date.now();
      const fixtures = [
        ['Blue Train', 'John Coltrane', 'Jazz'], ['So What', 'Miles Davis', 'Jazz'],
        ['An Ending (Ascent)', 'Brian Eno', 'Ambient'], ['Open Eye Signal', 'Jon Hopkins', 'Electronic'],
        ['Dreams', 'Fleetwood Mac', 'Rock'], ['Nights', 'Frank Ocean', 'R&B'],
        ['Jóga', 'Björk', 'Electronic'], ["Don't Know Why", 'Norah Jones', 'Jazz'],
        ['Svefn-g-englar', 'Sigur Rós', 'Post-rock'], ['Alright', 'Kendrick Lamar', 'Hip-hop'],
      ];
      const tracks = Array.from({ length: 4 + index % 2 }, (_, offset) => {
        const [title, artist, genre] = fixtures[(index + offset) % fixtures.length];
        return { id: String(offset), title, artist, genre };
      });
      const tastes = ['Still learning your taste; exploring variety in your library.', 'Frequent artists: Miles Davis. Genres: Jazz. Based on qualified listening and likes.', 'Recent qualified listening: Electronic and Ambient. Liked artists: Brian Eno.', 'Frequent artists: Fleetwood Mac. Genres: Rock. A balanced set of familiar and less-played related music.', 'Liked artists: Björk and Sigur Rós. Recent skips: one Jazz track.'];
      const result = await runtime.prepare({ requestId: randomUUID(), sessionId: randomUUID(), tracks, taste: tastes[index % tastes.length], welcome: index % 10 === 0, voice: index % 2 ? 'Heart' : 'Michael' });
      const row = { index, seconds: (Date.now() - started) / 1000, text: result.text, fallback: result.fallback, error: result.error }; report.push(row); console.log(JSON.stringify(row));
      const bytes = Buffer.from(result.wavBase64, 'base64');
      if (bytes.subarray(0, 4).toString() !== 'RIFF' || bytes.length < 1000) throw new Error('No valid voice WAV.');
      if (result.text.length > 360 || result.text.split(/(?<=[.!?])\s+/).length > 2) throw new Error('Unbounded commentary output.');
      if (row.seconds > 60) throw new Error('Preparation exceeded the 60-second target.');
      await fs.mkdir('release-review', { recursive: true });
      if (index < 2) await fs.writeFile('release-review/dj-' + (index % 2 ? 'Heart' : 'Michael') + '.wav', bytes);
    }
    if (report.every(row => row.fallback)) throw new Error('All DJ commentary used fallback; local text inference did not work.');
  } catch (error) { console.error(error); process.exitCode = 1; }
  finally {
    runtime.cancel();
    await fs.mkdir('release-review', { recursive: true });
    await fs.writeFile(path.join('release-review', process.env.NEBULA_DJ_REPORT_NAME || 'dj-model-report.json'), JSON.stringify({ memoryGB: os.totalmem() / 2 ** 30, cpu: os.cpus()[0]?.model, report }, null, 2));
    app.exit(Number(process.exitCode || 0));
  }
});
