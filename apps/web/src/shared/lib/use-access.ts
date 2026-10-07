'use client';

import { useMemo } from 'react';
import type { AccessLevel, AccessResource, GrantLevel } from '@mcdi/contracts';

import { useAuthStore } from '@/features/auth/stores/auth';
import {
  canAccess,
  levelOf,
  need,
  type AccessSubject,
  type Requirement,
} from '@/shared/lib/access';

/** The signed-in member's access, or null when nobody is signed in. */
export function useAccessSubject(): AccessSubject | null {
  const user = useAuthStore((state) => state.user);
  return useMemo(() => (user ? { root: user.root, permissions: user.permissions } : null), [user]);
}

export function useCanAccess(requirement: Requirement): boolean {
  const subject = useAccessSubject();
  return canAccess(subject, requirement);
}

/** Whether the member reaches `level` on `resource`. Levels are cumulative. */
export function useCan(resource: AccessResource, level: GrantLevel): boolean {
  return useCanAccess(need(resource, level));
}

export function useLevel(resource: AccessResource): AccessLevel {
  const subject = useAccessSubject();
  return levelOf(subject, resource);
}
