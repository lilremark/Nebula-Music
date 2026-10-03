import { createEchogardenSynth } from './echogardenSynth';

const port = (process as unknown as { parentPort: { on(event: string, listener: (event: { data: { id: string; text: string; voice: string } }) => void): void; postMessage(message: unknown): void } }).parentPort;
// Model packages are always bundled; voice synthesis has no network path.
globalThis.fetch = async () => { throw new Error('Networking is disabled in the DJ voice process.'); };
const synth = createEchogardenSynth({ cacheDir: process.env.NEBULA_DJ_VOICE_CACHE });
port.on('message', async ({ data }) => {
  try {
    const { wavBytes } = await synth.synthesize(data.text, data.voice);
    port.postMessage({ id: data.id, wavBase64: Buffer.from(wavBytes).toString('base64') });
  } catch (error) { port.postMessage({ id: data.id, error: error instanceof Error ? error.message : 'Voice synthesis failed.' }); }
});
