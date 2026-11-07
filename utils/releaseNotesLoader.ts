import { parseReleaseNotes, type ReleaseNotes } from './releaseNotes';

// Each notes file becomes its own small chunk; only the running version's is fetched.
const NOTES_FILES = import.meta.glob<string>('../docs/release/v*.md', { query: '?raw', import: 'default' });

/** Loads and parses docs/release/v<version>.md, or resolves null when it is missing or invalid. */
export const loadReleaseNotes = async (version: string): Promise<ReleaseNotes | null> => {
  const load = NOTES_FILES[`../docs/release/v${version}.md`];
  if (!load) return null;
  const { notes, errors } = parseReleaseNotes(await load());
  if (!notes) console.warn(`Release notes for ${version} are invalid:`, errors);
  return notes;
};
