import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const designSystemRoot = fileURLToPath(new URL('.', import.meta.url));
const workspaceRoot = fileURLToPath(new URL('..', import.meta.url));
const productionDb = path.resolve(workspaceRoot, 'services/db');
const productionService = path.resolve(workspaceRoot, 'services/subsonicService');
const previewService = path.resolve(designSystemRoot, 'studio/PreviewSubsonicService.ts');
const canonicalModuleId = (id: string) => path.normalize(id.split('?')[0])
  .replace(/\\/g, '/')
  .replace(/\.(?:[cm]?[jt]sx?)$/, '')
  .toLowerCase();

/**
 * Redirect only imports resolving to the production persistence/service files.
 * This allows Studio to compose the actual Store and views without sharing a
 * database or network audio dependency with the desktop application.
 */
const studioPreviewAdapter = {
  name: 'studio-preview-adapter',
  enforce: 'pre' as const,
  resolveId(source: string, importer?: string) {
    if (!importer || !source.startsWith('.')) return null;
    // PreviewSubsonicService deliberately inherits the production service. Do
    // not redirect that one import back to the preview module.
    if (canonicalModuleId(importer) === canonicalModuleId(previewService)) return null;
    const resolved = path.resolve(path.dirname(importer), source);
    if (canonicalModuleId(resolved) === canonicalModuleId(productionDb)) {
      return path.resolve(designSystemRoot, 'studio/PreviewDb.ts');
    }
    if (canonicalModuleId(resolved) === canonicalModuleId(productionService)) {
      return path.resolve(designSystemRoot, 'studio/PreviewSubsonicService.ts');
    }
    return null;
  },
};

// A separate entry keeps reference pages and the interactive preview isolated.
export default defineConfig({
  root: designSystemRoot,
  plugins: [studioPreviewAdapter, react()],
  server: {
    port: 3100,
    strictPort: true,
    fs: { allow: [workspaceRoot] },
  },
  build: {
    outDir: '../dist-design-system',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        gallery: fileURLToPath(new URL('index.html', import.meta.url)),
        refinements: fileURLToPath(new URL('refinements.html', import.meta.url)),
        studio: fileURLToPath(new URL('studio.html', import.meta.url)),
        studioCatalog: fileURLToPath(new URL('studio-catalog.html', import.meta.url)),
      },
    },
  },
});
