import type { EQBands } from '../constants/eqPresets';

export interface AutoEqIndexEntry {
  id: string;
  name: string;
  source: string;
  path: string;
  rawUrl: string;
}

export interface AutoEqProfile {
  bands: EQBands;
  preamp?: number;
  raw: string;
}

interface CachedIndex {
  fetchedAt: number;
  entries: AutoEqIndexEntry[];
}

const RAW_BASE = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq/master/';
const TREE_URL = 'https://api.github.com/repos/jaakkopasanen/AutoEq/git/trees/master?recursive=1';
const INDEX_URLS = [
  `${RAW_BASE}results/INDEX.md`,
  `${RAW_BASE}results/README.md`,
];
const CACHE_KEY = 'nebula_autoeq_index_v2';
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;

const BAND_KEYS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'] as const;
const BAND_FREQUENCIES: Record<keyof EQBands, number> = {
  '32': 32,
  '64': 64,
  '125': 125,
  '250': 250,
  '500': 500,
  '1k': 1000,
  '2k': 2000,
  '4k': 4000,
  '8k': 8000,
  '16k': 16000,
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/%20/g, ' ')
    .replace(/[_/()[\],.-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clampGain = (value: number) => Math.max(-12, Math.min(12, Math.round(value)));

const encodePath = (path: string) => path.split('/').map(encodeURIComponent).join('/');

const decodePathSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const decodePath = (path: string) => path.split('/').map(decodePathSegment).join('/');

const createEntryFromFixedBandPath = (path: string): AutoEqIndexEntry | null => {
  if (!path.startsWith('results/') || !path.endsWith(' FixedBandEQ.txt')) return null;

  const parts = path.split('/');
  const fileName = decodePathSegment(parts[parts.length - 1] || '');
  const name = fileName.replace(/\s+FixedBandEQ\.txt$/i, '').replace(/_/g, ' ').trim();
  if (!name) return null;

  const sourceParts = parts.slice(1, -2).map(part => decodePathSegment(part).replace(/_/g, ' '));
  const source = sourceParts.join(' / ') || 'AutoEq';

  return {
    id: path,
    name,
    source,
    path,
    rawUrl: `${RAW_BASE}${encodePath(path)}`,
  };
};

const pathToFixedBandPath = (path: string) => {
  let normalized = path.trim();
  normalized = normalized.replace(/^https:\/\/github\.com\/jaakkopasanen\/AutoEq\/blob\/master\//, '');
  normalized = normalized.replace(/^https:\/\/raw\.githubusercontent\.com\/jaakkopasanen\/AutoEq\/master\//, '');
  normalized = normalized.replace(/^\.\//, 'results/');
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.split('#')[0].split('?')[0];
  normalized = decodePath(normalized);

  if (!normalized.startsWith('results/')) return null;
  if (normalized.endsWith(' FixedBandEQ.txt')) return normalized;

  const directoryPath = normalized.endsWith('/README.md')
    ? normalized.replace(/\/README\.md$/, '')
    : normalized.replace(/\/$/, '');
  const directoryName = directoryPath.split('/').pop();
  if (!directoryName) return null;

  return `${directoryPath}/${directoryName} FixedBandEQ.txt`;
};

const parseMarkdownIndex = (markdown: string): AutoEqIndexEntry[] => {
  const entries = new Map<string, AutoEqIndexEntry>();
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(markdown))) {
    const label = match[1].replace(/`/g, '').trim();
    const fixedBandPath = pathToFixedBandPath(match[2]);
    const entry = fixedBandPath ? createEntryFromFixedBandPath(fixedBandPath) : null;
    if (entry) {
      entries.set(entry.path, { ...entry, name: label || entry.name });
    }
  }

  return Array.from(entries.values());
};

const fetchMarkdownIndex = async () => {
  for (const url of INDEX_URLS) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const entries = parseMarkdownIndex(await response.text());
      if (entries.length > 100) return entries;
    } catch {
      // Try the next source before falling back to the tree API.
    }
  }
  return [];
};

const fetchTreeIndex = async () => {
  const response = await fetch(TREE_URL, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new Error(`AutoEq index request failed (${response.status})`);
  }

  const data = await response.json() as { tree?: Array<{ path?: string; type?: string }>; truncated?: boolean };
  const entries = new Map<string, AutoEqIndexEntry>();
  for (const node of data.tree || []) {
    if (node.type !== 'blob' || !node.path) continue;
    const entry = createEntryFromFixedBandPath(node.path);
    if (entry) entries.set(entry.path, entry);
  }

  if (entries.size === 0) {
    throw new Error(data.truncated ? 'AutoEq index was truncated by GitHub.' : 'No AutoEq fixed-band profiles were found.');
  }

  return Array.from(entries.values());
};

const readCachedIndex = (): CachedIndex | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedIndex;
    if (!Array.isArray(parsed.entries)) return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeCachedIndex = (entries: AutoEqIndexEntry[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), entries }));
  } catch {
    // Local storage can be unavailable in private browsing; the feature still works without caching.
  }
};

export const getCachedAutoEqIndexInfo = () => readCachedIndex();

export const fetchAutoEqIndex = async (force = false): Promise<AutoEqIndexEntry[]> => {
  const cached = readCachedIndex();
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.entries;
  }

  const markdownEntries = await fetchMarkdownIndex();
  const entries = markdownEntries.length > 0 ? markdownEntries : await fetchTreeIndex();
  entries.sort((a, b) => a.name.localeCompare(b.name) || a.source.localeCompare(b.source));
  writeCachedIndex(entries);
  return entries;
};

export const searchAutoEqProfiles = async (query: string, limit = 20): Promise<AutoEqIndexEntry[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const terms = normalizeText(trimmed).split(' ').filter(Boolean);
  const entries = await fetchAutoEqIndex();

  return entries
    .map(entry => {
      const haystack = normalizeText(`${entry.name} ${entry.source}`);
      if (!terms.every(term => haystack.includes(term))) return null;
      const startsWithName = normalizeText(entry.name).startsWith(terms.join(' '));
      const score = (startsWithName ? 0 : 20) + Math.abs(entry.name.length - trimmed.length) + entry.source.length * 0.02;
      return { entry, score };
    })
    .filter((result): result is { entry: AutoEqIndexEntry; score: number } => Boolean(result))
    .sort((a, b) => a.score - b.score || a.entry.name.localeCompare(b.entry.name))
    .slice(0, limit)
    .map(result => result.entry);
};

const parsePreamp = (text: string) => {
  const match = text.match(/Preamp:\s*([-+]?\d+(?:\.\d+)?)\s*dB/i);
  return match ? Number(match[1]) : undefined;
};

const parseGraphicEq = (text: string) => {
  const match = text.match(/GraphicEQ:\s*([^\n\r]+)/i);
  if (!match) return new Map<number, number>();

  const values = new Map<number, number>();
  const pairPattern = /(\d+(?:\.\d+)?)\s+([-+]?\d+(?:\.\d+)?)/g;
  let pair: RegExpExecArray | null;
  while ((pair = pairPattern.exec(match[1]))) {
    values.set(Number(pair[1]), Number(pair[2]));
  }
  return values;
};

const parseFilterGains = (text: string) => {
  const values = new Map<number, number>();
  const filterPattern = /Fc\s+(\d+(?:\.\d+)?)\s*Hz\s+Gain\s+([-+]?\d+(?:\.\d+)?)\s*dB/gi;
  let filter: RegExpExecArray | null;
  while ((filter = filterPattern.exec(text))) {
    values.set(Number(filter[1]), Number(filter[2]));
  }
  return values;
};

const nearestGainForBand = (values: Map<number, number>, targetFrequency: number) => {
  let best: { frequency: number; gain: number; distance: number } | null = null;
  values.forEach((gain, frequency) => {
    const distance = Math.abs(Math.log2(frequency / targetFrequency));
    if (!best || distance < best.distance) {
      best = { frequency, gain, distance };
    }
  });

  return best && best.distance <= 0.2 ? best.gain : 0;
};

const mapFixedBands = (values: Map<number, number>): EQBands => {
  const bands = {} as EQBands;
  BAND_KEYS.forEach(key => {
    bands[key] = clampGain(nearestGainForBand(values, BAND_FREQUENCIES[key]));
  });
  return bands;
};

export const parseAutoEqFixedBandProfile = (text: string): AutoEqProfile => {
  const graphicEq = parseGraphicEq(text);
  const values = graphicEq.size > 0 ? graphicEq : parseFilterGains(text);

  if (values.size < 6) {
    throw new Error('This AutoEq profile does not contain enough fixed-band EQ data.');
  }

  return {
    bands: mapFixedBands(values),
    preamp: parsePreamp(text),
    raw: text,
  };
};

export const fetchAutoEqProfile = async (entry: AutoEqIndexEntry): Promise<AutoEqProfile> => {
  const response = await fetch(entry.rawUrl);
  if (!response.ok) {
    throw new Error(`AutoEq profile request failed (${response.status})`);
  }

  return parseAutoEqFixedBandProfile(await response.text());
};
