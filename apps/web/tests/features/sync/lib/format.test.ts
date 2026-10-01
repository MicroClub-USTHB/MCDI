import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatAbsoluteTime, formatDuration, formatRelativeTime } from '@/features/sync/lib/format';

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T12:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty or unparseable input', () => {
    expect(formatRelativeTime(null)).toBeNull();
    expect(formatRelativeTime('not-a-date')).toBeNull();
  });

  it('formats a past timestamp in the largest fitting unit', () => {
    expect(formatRelativeTime('2026-08-28T09:00:00.000Z')).toBe('3 hours ago');
    expect(formatRelativeTime('2026-08-26T12:00:00.000Z')).toBe('2 days ago');
  });
});

describe('formatDuration', () => {
  it('scales the unit to the span', () => {
    expect(formatDuration(820)).toBe('820ms');
    expect(formatDuration(4300)).toBe('4.3s');
    expect(formatDuration(72_000)).toBe('1m 12s');
  });

  it('returns null for unknown or negative spans', () => {
    expect(formatDuration(null)).toBeNull();
    expect(formatDuration(-5)).toBeNull();
  });
});

describe('formatAbsoluteTime', () => {
  it('returns null for empty input and a string otherwise', () => {
    expect(formatAbsoluteTime(null)).toBeNull();
    expect(formatAbsoluteTime('2026-08-28T10:00:00.000Z')).toEqual(expect.any(String));
  });
});
