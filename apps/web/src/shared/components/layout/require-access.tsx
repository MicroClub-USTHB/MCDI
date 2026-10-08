'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

import { AccessDenied, NoAccessYet } from '@/shared/components/layout/no-access';
import { firstAllowedHref } from '@/shared/components/layout/visible-nav';
import { canAccess, hasAnyAccess } from '@/shared/lib/access';
import { requirementForPath } from '@/shared/lib/route-access';
import { useAccessSubject } from '@/shared/lib/use-access';

/**
 * Page guard for the dashboard. It adapts the panel to the member's access; the API still refuses
 * what the member may not do. A route that is not in the route table is denied.
 */
export function RequireAccess({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const subject = useAccessSubject();
  const requirement = requirementForPath(pathname);

  if (requirement && canAccess(subject, requirement)) return <>{children}</>;
  if (pathname === '/dashboard' && !hasAnyAccess(subject)) return <NoAccessYet />;
  return <AccessDenied requirement={requirement} href={firstAllowedHref(subject)} />;
}
