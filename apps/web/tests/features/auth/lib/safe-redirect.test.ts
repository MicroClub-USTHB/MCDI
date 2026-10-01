import { describe, it, expect } from 'vitest';
import { getSafeRedirectPath } from '@/features/auth/lib/safe-redirect';

describe('getSafeRedirectPath', () => {
  it('allows a same-origin relative path', () => {
    expect(getSafeRedirectPath('/dashboard/servers')).toBe('/dashboard/servers');
  });

  it('falls back to /dashboard when the target is missing', () => {
    expect(getSafeRedirectPath(null)).toBe('/dashboard');
    expect(getSafeRedirectPath(undefined)).toBe('/dashboard');
    expect(getSafeRedirectPath('')).toBe('/dashboard');
  });

  it('rejects absolute URLs to another origin', () => {
    expect(getSafeRedirectPath('https://evil.com/phish')).toBe('/dashboard');
    expect(getSafeRedirectPath('http://evil.com')).toBe('/dashboard');
  });

  it('rejects protocol-relative URLs', () => {
    expect(getSafeRedirectPath('//evil.com')).toBe('/dashboard');
  });

  it('rejects backslash tricks browsers may treat as protocol-relative', () => {
    expect(getSafeRedirectPath('/\\evil.com')).toBe('/dashboard');
  });

  it('honors a custom fallback', () => {
    expect(getSafeRedirectPath('javascript:alert(1)', '/login')).toBe('/login');
  });
});
