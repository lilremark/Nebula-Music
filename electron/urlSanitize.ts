/** Strip `user:pass@` userinfo so plaintext settings never carry credentials. */
export const sanitizeServerUrlForSettings = (url: string): string => {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    return url;
  }
};
