'use client';

import type { ReactNode } from 'react';
import type { AccessResource, GrantLevel } from '@mcdi/contracts';

import { useCan } from '@/shared/lib/use-access';

interface CanProps {
  resource: AccessResource;
  level: GrantLevel;
  /** Shown when the member is below `level`. Nothing by default. */
  fallback?: ReactNode;
  children: ReactNode;
}

/** Renders `children` only when the member reaches `level` on `resource`. */
export function Can({ resource, level, fallback = null, children }: CanProps) {
  return useCan(resource, level) ? <>{children}</> : <>{fallback}</>;
}
