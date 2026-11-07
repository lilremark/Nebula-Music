/**
 * Release notes are written once per version in `docs/release/v<version>.md`
 * and drive both the GitHub release body (scripts/releaseNotes.mjs) and the
 * in-app What's New dialog. The format is described in docs/release/README.md.
 *
 * This module has no imports and uses only erasable TypeScript, so the release
 * scripts can load it directly with Node's type stripping.
 */

export type ReleaseChangeType = 'feature' | 'performance' | 'fix';

export interface ReleaseSection {
  type: ReleaseChangeType;
  heading: string;
  /** Top-level bullets as plain text; these are what the app shows. */
  items: string[];
}

export interface ReleaseNotes {
  version: string;
  date: string;
  title: string;
  summary: string;
  sections: ReleaseSection[];
  /** Markdown after the frontmatter, for the GitHub release body. */
  body: string;
}

/** Change categories in the order they must appear. */
export const RELEASE_SECTIONS: readonly { type: ReleaseChangeType; heading: string }[] = [
  { type: 'feature', heading: 'Features' },
  { type: 'performance', heading: 'Performance' },
  { type: 'fix', heading: 'Bug fixes' },
];

/** Optional GitHub-only section for install and platform caveats; must be last. */
export const NOTES_HEADING = 'Notes';

const VERSION_SHAPE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;
const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/** Removes inline Markdown so a bullet reads as plain text in the app. */
export const toPlainText = (markdown: string): string =>
  markdown
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|[^\w*])\*([^*]+)\*(?=$|[^\w*])/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export const parseReleaseNotes = (
  markdown: string,
): { notes: ReleaseNotes | null; errors: string[] } => {
  const errors: string[] = [];
  const text = markdown.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const frontmatter = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (!frontmatter) {
    return { notes: null, errors: ['missing frontmatter block (--- version/date/title ---)'] };
  }

  const fields: Record<string, string> = {};
  for (const line of frontmatter[1].split('\n')) {
    if (!line.trim()) continue;
    const match = /^([a-z]+):\s*(.*)$/.exec(line);
    if (!match) {
      errors.push(`invalid frontmatter line: ${line}`);
      continue;
    }
    fields[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  for (const key of Object.keys(fields)) {
    if (!['version', 'date', 'title'].includes(key)) errors.push(`unknown frontmatter field: ${key}`);
  }
  const version = fields.version ?? '';
  const date = fields.date ?? '';
  const title = fields.title ?? '';
  if (!VERSION_SHAPE.test(version)) errors.push(`frontmatter version "${version}" is not a semver version`);
  if (!DATE_SHAPE.test(date) || Number.isNaN(Date.parse(date))) errors.push(`frontmatter date "${date}" is not YYYY-MM-DD`);
  if (!title) errors.push('frontmatter title is required');

  const body = text.slice(frontmatter[0].length).trim();
  const lines = body.split('\n');
  const summary: string[] = [];
  const sections: ReleaseSection[] = [];
  const seen: string[] = [];
  let current: ReleaseSection | null = null;
  let inNotes = false;
  let inFence = false;
  let lastItemOpen = false;

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = inFence ? null : /^(#{1,6})\s+(.*?)\s*$/.exec(line);

    if (heading) {
      lastItemOpen = false;
      if (heading[1] !== '##') {
        if (!inNotes) errors.push(`line ${lineNo}: only "## " section headings are allowed outside Notes`);
        return;
      }
      const name = heading[2];
      if (seen.includes(name)) errors.push(`line ${lineNo}: duplicate section "${name}"`);
      if (inNotes) errors.push(`line ${lineNo}: "${NOTES_HEADING}" must be the last section`);
      seen.push(name);
      if (name === NOTES_HEADING) {
        current = null;
        inNotes = true;
        return;
      }
      const known = RELEASE_SECTIONS.find(section => section.heading === name);
      if (!known) {
        errors.push(`line ${lineNo}: unknown section "${name}" (use ${RELEASE_SECTIONS.map(s => s.heading).join(', ')} or ${NOTES_HEADING})`);
        current = null;
        return;
      }
      const previous = sections[sections.length - 1];
      if (previous && RELEASE_SECTIONS.findIndex(s => s.type === previous.type) > RELEASE_SECTIONS.indexOf(known)) {
        errors.push(`line ${lineNo}: "${name}" must come before "${previous.heading}"`);
      }
      current = { type: known.type, heading: known.heading, items: [] };
      sections.push(current);
      return;
    }

    if (inNotes) return;
    if (!current) {
      if (seen.length === 0) summary.push(line);
      return;
    }
    if (!line.trim()) {
      lastItemOpen = false;
      return;
    }
    const item = /^[-*]\s+(.*)$/.exec(line);
    if (item) {
      current.items.push(item[1]);
      lastItemOpen = true;
      return;
    }
    if (/^\s{2,}\S/.test(line)) {
      // Indented continuation of the previous bullet, or GitHub-only detail
      // (sub-bullets) that the app does not show.
      if (lastItemOpen && !/^\s+[-*]\s/.test(line)) {
        current.items[current.items.length - 1] += ` ${line.trim()}`;
      } else {
        lastItemOpen = false;
      }
      return;
    }
    errors.push(`line ${lineNo}: text under "${current.heading}" must be a "- " bullet`);
  });

  if (sections.length === 0) errors.push(`at least one of ${RELEASE_SECTIONS.map(s => s.heading).join(', ')} is required`);
  for (const section of sections) {
    if (section.items.length === 0) errors.push(`section "${section.heading}" has no bullets`);
    section.items = section.items.map(toPlainText);
  }

  if (errors.length) return { notes: null, errors };
  return {
    notes: { version, date, title, summary: toPlainText(summary.join('\n')), sections, body },
    errors,
  };
};

/** The GitHub release body for these notes (installation caveats are added by the workflow). */
export const renderGitHubReleaseNotes = (notes: ReleaseNotes): string =>
  `# ${notes.title}\n\n${notes.body}\n`;
