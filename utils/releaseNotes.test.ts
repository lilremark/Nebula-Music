import { describe, expect, it } from 'vitest';
import { parseReleaseNotes, renderGitHubReleaseNotes, toPlainText } from './releaseNotes';

const notes = (body: string, front = 'version: 1.2.3-beta.1\ndate: 2026-11-06\ntitle: Example') =>
  `---\n${front}\n---\n\n${body}`;

describe('release notes format', () => {
  it('parses categorized bullets, continuations and GitHub-only detail', () => {
    const { notes: parsed, errors } = parseReleaseNotes(notes(
      'A short summary.\n\n'
      + '## Features\n\n- Add **queue** saving with [docs](https://x.test).\n  It survives restarts.\n  - GitHub-only detail\n\n'
      + '## Performance\n\n- Use `less` CPU.\n\n'
      + '## Bug fixes\n\n- Fix a crash.\n\n'
      + '## Notes\n\nAnything goes here.\n### Even subheadings\n',
    ));
    expect(errors).toEqual([]);
    expect(parsed).toMatchObject({
      version: '1.2.3-beta.1',
      date: '2026-11-06',
      title: 'Example',
      summary: 'A short summary.',
      sections: [
        { type: 'feature', heading: 'Features', items: ['Add queue saving with docs. It survives restarts.'] },
        { type: 'performance', heading: 'Performance', items: ['Use less CPU.'] },
        { type: 'fix', heading: 'Bug fixes', items: ['Fix a crash.'] },
      ],
    });
    expect(renderGitHubReleaseNotes(parsed!)).toMatch(/^# Example\n\nA short summary\.\n\n## Features\n/);
  });

  it.each([
    ['missing frontmatter', '## Features\n\n- x', /missing frontmatter/],
    ['unknown section', notes('## Improvements\n\n- x'), /unknown section "Improvements"/],
    ['wrong order', notes('## Bug fixes\n\n- x\n\n## Features\n\n- y'), /"Features" must come before "Bug fixes"/],
    ['empty section', notes('## Performance\n\n## Bug fixes\n\n- x'), /section "Performance" has no bullets/],
    ['no categories', notes('Only a summary.'), /at least one of Features, Performance, Bug fixes/],
    ['prose in a section', notes('## Features\n\nSome paragraph.'), /must be a "- " bullet/],
    ['notes not last', notes('## Notes\n\nx\n\n## Features\n\n- y'), /"Notes" must be the last section/],
    ['duplicate section', notes('## Features\n\n- x\n\n## Features\n\n- y'), /duplicate section "Features"/],
    ['bad date', notes('## Features\n\n- x', 'version: 1.0.0\ndate: Nov 6\ntitle: T'), /not YYYY-MM-DD/],
  ])('rejects %s', (_label, markdown, error) => {
    const { notes: parsed, errors } = parseReleaseNotes(markdown);
    expect(parsed).toBeNull();
    expect(errors.join('\n')).toMatch(error);
  });

  it('strips inline markdown for the app', () => {
    expect(toPlainText('Use *fast* `npm ci` via [this](https://a.test) and **bold**')).toBe('Use fast npm ci via this and bold');
  });
});

