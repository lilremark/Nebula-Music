
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: [
        'services/streamDeckProtocol.ts',
        'services/streamDeckCommands.ts',
        'services/streamDeckAuthentication.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 70,
      },
    },
  },
  build: {
    // The mini-player is a separate always-on-top window. Both HTML entries
    // are emitted side-by-side and served by the custom app:// protocol.
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        miniPlayer: resolve(__dirname, 'mini-player.html'),
      },
    },
    // hls.js is lazy-loaded only for browser-managed .m3u8 radio streams.
    // Its isolated async chunk is slightly above Vite's default 500 kB warning budget.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3000,
  },
});
