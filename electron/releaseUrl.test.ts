import { describe, expect, it } from 'vitest';
import { releaseUrlForVersion } from './releaseUrl';

describe('releaseUrlForVersion', () => {
  it.each(['2.4.1', '2.5.0-beta.1', '3.0.0-rc.2'])('builds a canonical URL for %s', (version) => {
    expect(releaseUrlForVersion(version)).toBe(
      `https://github.com/lilremark/Nebula-Music/releases/tag/v${version}`,
    );
  });

  it.each(['', 'v2.4.1', '2.4', '2.4.1/../../x', '2.4.1?x=1', 'latest'])(
    'rejects invalid version %j',
    (version) => {
      expect(releaseUrlForVersion(version)).toBeNull();
    },
  );
});
