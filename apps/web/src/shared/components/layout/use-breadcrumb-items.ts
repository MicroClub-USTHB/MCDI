'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';

import { useProjectsQuery } from '@/features/projects/api/queries';
import { useServersQuery } from '@/features/servers/api/queries';
import type { BreadcrumbItem } from '@/shared/components/layout/breadcrumb';
import {
  NAV_GROUPS,
  contextFromPath,
  contextHref,
  isLinkActive,
} from '@/shared/components/layout/nav-items';
import type { ContextKind } from '@/shared/lib/last-context';

/** Display names of servers and projects, keyed by id, for labelling the crumb that names one. */
export type ContextNames = Partial<Record<ContextKind, Map<string, string>>>;

function toTitleCase(segment: string): string {
  return segment
    .split('-')
    .map((word) => (word[0] ?? '').toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Pure so it's testable without mounting a component.
 *
 * - A page under a server or project reads "Servers › MicroClub › Roles", the
 *   name coming from `names` (or "Server" until the list has loaded).
 * - Any other page is matched to its sidebar link; deeper pages stay under it.
 * - Unknown routes fall back to title-casing the trailing segment.
 *
 * Returns an empty array on the dashboard root: a single "Dashboard" crumb
 * with nothing to link to is pure noise there.
 */
export function getBreadcrumbItems(pathname: string, names: ContextNames = {}): BreadcrumbItem[] {
  if (pathname === '/dashboard') {
    return [];
  }

  const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

  for (const { context } of NAV_GROUPS) {
    if (!context) continue;
    const here = contextFromPath(pathname, context.base);
    if (!here) continue;

    const overview = contextHref(context.base, here.id, '');
    const name = names[context.kind]?.get(here.id) ?? toTitleCase(context.noun);
    items.push({ label: context.list.name, href: context.list.route });
    if (!here.segment) {
      items.push({ label: name });
      return items;
    }
    const page = context.subItems.find((item) => item.segment === here.segment);
    items.push({ label: name, href: overview });
    items.push({ label: page?.name ?? toTitleCase(here.segment) });
    return items;
  }

  const lists = NAV_GROUPS.flatMap((group) => (group.context ? [group.context.list] : []));
  const list = lists.find((entry) => entry.route === pathname);
  if (list) {
    items.push({ label: list.name });
    return items;
  }

  const link = NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => item.route !== '/dashboard' && isLinkActive(pathname, { ...item, exact: false })
  );
  if (link) {
    items.push({ label: link.name });
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
  const { data: servers } = useServersQuery();
  const { data: projects } = useProjectsQuery();

  const names = useMemo<ContextNames>(
    () => ({
      server: new Map((servers ?? []).map((server) => [server.id, server.name])),
      project: new Map((projects ?? []).map((project) => [project.id, project.name])),
    }),
    [servers, projects]
  );

  return getBreadcrumbItems(pathname, names);
}
