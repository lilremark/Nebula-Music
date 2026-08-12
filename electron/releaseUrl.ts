const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/;

export const releaseUrlForVersion = (version: string): string | null =>
  RELEASE_VERSION.test(version)
    ? `https://github.com/lilremark/Nebula-Music/releases/tag/v${version}`
    : null;
