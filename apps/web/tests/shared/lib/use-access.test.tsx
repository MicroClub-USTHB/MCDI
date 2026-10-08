import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { signInAs, signOut } from '../../helpers/auth';
import { need } from '@/shared/lib/access';
import { useAccessSubject, useCan, useCanAccess, useLevel } from '@/shared/lib/use-access';

describe('useCan', () => {
  it('follows the signed-in member', () => {
    signInAs({ permissions: { projects: 'write' } });

    expect(renderHook(() => useCan('projects', 'read')).result.current).toBe(true);
    expect(renderHook(() => useCan('projects', 'write')).result.current).toBe(true);
    expect(renderHook(() => useCan('projects', 'manage')).result.current).toBe(false);
    expect(renderHook(() => useCan('members', 'read')).result.current).toBe(false);
  });

  it('is true for root everywhere', () => {
    signInAs({ root: true });
    expect(renderHook(() => useCan('messages', 'manage')).result.current).toBe(true);
  });

  it('is false for everything when nobody is signed in', () => {
    signOut();
    expect(renderHook(() => useCan('projects', 'read')).result.current).toBe(false);
    expect(renderHook(() => useAccessSubject()).result.current).toBeNull();
  });
});

describe('useCanAccess and useLevel', () => {
  it('evaluates a requirement and reports the level', () => {
    signInAs({ permissions: { audit: 'read' } });
    expect(renderHook(() => useCanAccess(need('audit', 'read'))).result.current).toBe(true);
    expect(renderHook(() => useCanAccess(need('audit', 'write'))).result.current).toBe(false);
    expect(renderHook(() => useLevel('audit')).result.current).toBe('read');
    expect(renderHook(() => useLevel('sync')).result.current).toBe('none');
  });
});
