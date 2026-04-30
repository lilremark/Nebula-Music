
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // hls.js is lazy-loaded only for browser-managed .m3u8 radio streams.
    // Its isolated async chunk is slightly above Vite's default 500 kB warning budget.
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 3000,
  },
});
