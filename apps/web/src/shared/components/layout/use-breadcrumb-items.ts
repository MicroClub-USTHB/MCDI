'use client';

import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/shared/components/layout/nav-items';
import type { BreadcrumbItem } from '@/shared/components/layout/breadcrumb';

function toTitleCase(segment: string): string {
  return segment
    .split('-')
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pure so it's testable without mounting a component. Matches `pathname`
 * against `NAV_ITEMS` for the top-level dashboard routes; anything deeper
 * (a future detail page, e.g. `/dashboard/servers/123`) falls back to
 * title-casing the trailing segment until that route has real data to name
 * itself with.
 *
 * Returns an empty array on the dashboard root: a single "Dashboard" crumb
 * with nothing to link to is pure noise sitting right above a page that
 * already says "Dashboard Overview" — `Breadcrumb` renders nothing for it.
 */
export function getBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  if (pathname === '/dashboard') {
    return [];
  }

  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];
  const match = NAV_ITEMS.find(
    (item) => item.route !== '/dashboard' && pathname.startsWith(item.route)
  );

  if (match) {
    items.push({ label: match.name });
  } else {
    const lastSegment = pathname.split('/').filter(Boolean).pop();
    if (lastSegment) {
      items.push({ label: toTitleCase(lastSegment) });
    }
  }

  return items;
}

export function useBreadcrumbItems(): BreadcrumbItem[] {
  const pathname = usePathname();
  return getBreadcrumbItems(pathname);
}
