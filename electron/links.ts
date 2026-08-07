/** External URL validation for links opened from the renderer. */
const ALLOWED_EXTERNAL_SCHEMES = new Set(['https:', 'mailto:']);

export const isAllowedExternalUrl = (rawUrl: string): boolean => {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 4096) return false;
  try {
    const parsed = new URL(rawUrl);
    return ALLOWED_EXTERNAL_SCHEMES.has(parsed.protocol);
  } catch {
    return false;
  }
};
