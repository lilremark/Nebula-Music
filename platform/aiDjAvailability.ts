import type { PlatformInfo } from './types';

/** Local inference is supported only by the Windows desktop build. */
export const isLocalDjPlatform = (info: Pick<PlatformInfo, 'kind' | 'os'> | null | undefined): boolean =>
  info?.kind === 'desktop' && info.os === 'win32';
