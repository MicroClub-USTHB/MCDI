import { describe, expect, it } from 'vitest';

import { pickContextId, readLastContextId, rememberContextId } from '@/shared/lib/last-context';

describe('last-context', () => {
  it('remembers the last server and project separately', () => {
    rememberContextId('server', 'srv_2');
    rememberContextId('project', 'proj_9');

    expect(readLastContextId('server')).toBe('srv_2');
    expect(readLastContextId('project')).toBe('proj_9');
  });

  it('has nothing remembered by default', () => {
    expect(readLastContextId('server')).toBeNull();
  });

  describe('pickContextId', () => {
    const options = [{ id: 'a' }, { id: 'b' }];

    it('prefers the last-used entry while it still exists', () => {
      expect(pickContextId(options, 'b')).toBe('b');
    });

    it('falls back to the first entry when the last-used one is gone', () => {
      expect(pickContextId(options, 'deleted')).toBe('a');
      expect(pickContextId(options, null)).toBe('a');
    });

    it('returns null when there is nothing to pick', () => {
      expect(pickContextId([], 'b')).toBeNull();
    });
  });
});
