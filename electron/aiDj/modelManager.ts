import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DJ_DOWNLOADS, DJ_MODEL_FILES } from './downloadCatalog';
import type { DjModelStatus } from './localProtocol';

interface ModelFile { file: string; size: number; sha256: string }
interface Download extends ModelFile { url: string; kind: string }
const run = promisify(execFile);
const archiveTool = process.platform === 'win32' ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
export async function matchesModelFile(root: string, entry: ModelFile, signal?: AbortSignal) {
  const file = path.resolve(root, entry.file);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error('Invalid model path.');
  if ((await fs.stat(file)).size !== entry.size) return false;
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) { signal?.throwIfAborted(); hash.update(chunk); }
  return hash.digest('hex') === entry.sha256;
}

/** Downloads are explicit, pinned, and activated only after every file is verified. */
export class DjModelManager {
  readonly resources: string;
  private controller: AbortController | null = null;
  private pending: Promise<DjModelStatus> | null = null;
  private checking: Promise<DjModelStatus> | null = null;
  private verified = false;
  private state: DjModelStatus;
  constructor(private root: string, private notify: (state: DjModelStatus) => void = () => {},
    private fetcher: typeof fetch = fetch, private downloads: readonly Download[] = DJ_DOWNLOADS,
    private files: readonly ModelFile[] = DJ_MODEL_FILES) {
    this.resources = path.join(root, 'installed');
    this.state = { phase: 'missing', ready: false, received: 0, total: downloads.reduce((sum, file) => sum + file.size, 0) };
  }
  private publish(patch: Partial<DjModelStatus>) { this.state = { ...this.state, ...patch }; this.notify({ ...this.state }); return { ...this.state }; }
  async status(): Promise<DjModelStatus> {
    if (this.pending || this.verified) return { ...this.state };
    if (this.checking) return this.checking;
    this.checking = this.checkInstalled().finally(() => { this.checking = null; });
    return this.checking;
  }
  private async checkInstalled(): Promise<DjModelStatus> {
    try {
      const manifest = JSON.parse(await fs.readFile(path.join(this.resources, 'manifest.json'), 'utf8'));
      if (JSON.stringify(manifest.files) !== JSON.stringify(this.files)) throw new Error('Model manifest needs repair.');
      for (const file of this.files) if (!await matchesModelFile(this.resources, file)) throw new Error('Model files need downloading or repair.');
      if (this.pending) return { ...this.state };
      this.verified = true;
      return this.publish({ phase: 'ready', ready: true, received: this.state.total, error: undefined });
    } catch { return { ...this.state }; }
  }
  cancel() { this.controller?.abort(new Error('Model download cancelled.')); }
  download(): Promise<DjModelStatus> {
    if (this.pending) return this.pending;
    const controller = new AbortController(); this.controller = controller;
    this.verified = false;
    this.publish({ phase: 'downloading', ready: false, received: 0, error: undefined });
    this.pending = this.install(controller.signal).catch(error => this.publish({ phase: controller.signal.aborted ? 'missing' : 'error', ready: false, file: undefined, error: controller.signal.aborted ? undefined : error instanceof Error ? error.message : 'Model download failed.' }))
      .finally(() => { this.controller = null; this.pending = null; });
    return this.pending;
  }
  private async install(signal: AbortSignal) {
    const cache = path.join(this.root, 'downloads'), staging = path.join(this.root, 'staging'), backup = path.join(this.root, 'previous');
    await fs.mkdir(cache, { recursive: true });
    await fs.rm(staging, { recursive: true, force: true });
    await fs.mkdir(path.join(staging, 'packages'), { recursive: true });
    let completed = 0;
    try {
      for (const asset of this.downloads) {
        signal.throwIfAborted();
        if (path.basename(asset.file) !== asset.file || new URL(asset.url).protocol !== 'https:') throw new Error('Invalid pinned model source.');
        this.publish({ phase: 'downloading', received: completed, file: asset.file });
        const cached = path.join(cache, asset.file);
        if (!await matchesModelFile(cache, asset, signal).catch(() => false)) {
          const partial = cached + '.partial';
          try {
            const response = await this.fetcher(asset.url, { signal });
            if (!response.ok || !response.body) throw new Error('Download failed (' + response.status + '). Retry when connected.');
            const output = await fs.open(partial, 'w');
            let received = 0, lastUpdate = 0;
            const hash = createHash('sha256');
            try {
              for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
                signal.throwIfAborted(); received += chunk.length;
                if (received > asset.size) throw new Error('Model download exceeded its expected size.');
                hash.update(chunk); await output.writeFile(chunk);
                if (Date.now() - lastUpdate > 200) { this.publish({ received: completed + received }); lastUpdate = Date.now(); }
              }
            } finally { await output.close(); }
            if (received !== asset.size || hash.digest('hex') !== asset.sha256) throw new Error('Model checksum failed. Retry the download.');
            signal.throwIfAborted(); await fs.rename(partial, cached);
          } finally { await fs.rm(partial, { force: true }); }
        }
        signal.throwIfAborted(); completed += asset.size;
        this.publish({ phase: 'installing', received: completed });
        if (asset.kind === 'model') await fs.copyFile(cached, path.join(staging, asset.file));
        else {
          const options = { windowsHide: true, signal, timeout: 60000, maxBuffer: 4 * 1024 * 1024 };
          const { stdout: listing } = await run(archiveTool, ['-tf', cached], options);
          const allowed = new Set(this.files.filter(file => file.file.startsWith('packages/')).map(file => file.file.slice(9)));
          for (const entry of listing.split(/\r?\n/).filter(Boolean)) {
            if (entry.startsWith('/') || entry.includes('\\') || entry.split('/').includes('..') || entry.includes(':') || (!entry.endsWith('/') && !allowed.has(entry))) throw new Error('Unsafe model archive path.');
          }
          const { stdout: details } = await run(archiveTool, ['-tvf', cached], options);
          if (details.split(/\r?\n/).filter(Boolean).some(line => !['-', 'd'].includes(line[0]))) throw new Error('Model archives cannot contain links.');
          await run(archiveTool, ['-xf', cached, '-C', path.join(staging, 'packages')], options);
        }
      }
      this.publish({ phase: 'installing', file: 'Verifying local models' });
      for (const file of this.files) if (!await matchesModelFile(staging, file, signal)) throw new Error('Extracted model checksum failed: ' + file.file);
      signal.throwIfAborted();
      await fs.writeFile(path.join(staging, 'manifest.json'), JSON.stringify({ files: this.files }));
      await fs.rm(backup, { recursive: true, force: true });
      const existing = await fs.stat(this.resources).then(() => true).catch(() => false);
      if (existing) await fs.rename(this.resources, backup);
      try { await fs.rename(staging, this.resources); }
      catch (error) { if (existing) await fs.rename(backup, this.resources); throw error; }
      await fs.rm(backup, { recursive: true, force: true });
      await fs.rm(cache, { recursive: true, force: true });
      this.verified = true;
      return this.publish({ phase: 'ready', ready: true, received: this.state.total, file: undefined, error: undefined });
    } finally { await fs.rm(staging, { recursive: true, force: true }); }
  }
}
