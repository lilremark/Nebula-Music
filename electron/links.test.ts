import { describe, expect, it } from 'vitest';
import { isAllowedExternalUrl } from './links';

describe('isAllowedExternalUrl', () => {
  it('accepts https URLs', () => {
    expect(isAllowedExternalUrl('https://example.com/radio')).toBe(true);
  });

  it('accepts mailto links', () => {
    expect(isAllowedExternalUrl('mailto:dev@nebula.app')).toBe(true);
  });

  it('rejects http URLs', () => {
    expect(isAllowedExternalUrl('http://example.com/radio')).toBe(false);
  });

  it('rejects dangerous schemes', () => {
    expect(isAllowedExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedExternalUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects malformed or empty input', () => {
    expect(isAllowedExternalUrl('')).toBe(false);
    expect(isAllowedExternalUrl('not a url')).toBe(false);
    expect(isAllowedExternalUrl(42 as unknown as string)).toBe(false);
  });

  it('rejects oversized URLs', () => {
    expect(isAllowedExternalUrl(`https://example.com/${'a'.repeat(5000)}`)).toBe(false);
  });
});
