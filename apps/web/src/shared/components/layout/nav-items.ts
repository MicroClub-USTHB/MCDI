import {
  Activity,
  BarChart3,
  FolderKanban,
  Hash,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Network,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ContextKind } from '@/shared/lib/last-context';

export interface NavLink {
  name: string;
  route: string;
  icon: LucideIcon;
  /** Active only on this exact route, not on pages below it. */
  exact?: boolean;
}

/** A page under the selected server or project; `segment` '' is its overview. */
export interface NavSubItem {
  name: string;
  segment: string;
  icon: LucideIcon;
}

/** A switcher picks the server or project, and the sub-items open its pages. */
export interface NavContext {
  kind: ContextKind;
  /** Pages live at `${base}/[id]/${segment}`. */
  base: string;
  /** Noun used in the switcher label and breadcrumbs: "server", "project". */
  noun: string;
  /** The list page, offered from the switcher and used as the breadcrumb parent. */
  list: { name: string; route: string };
  subItems: NavSubItem[];
}

export interface NavGroup {
  label: string;
  items: NavLink[];
  context?: NavContext;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', route: '/dashboard', icon: LayoutDashboard, exact: true },
      { name: 'Members', route: '/dashboard/members', icon: Users },
      { name: 'Stats', route: '/dashboard/stats', icon: BarChart3 },
    ],
  },
  {
    label: 'Discord',
    items: [],
    context: {
      kind: 'server',
      base: '/dashboard/servers',
      noun: 'server',
      list: { name: 'Servers', route: '/dashboard/servers' },
      subItems: [
        { name: 'Overview', segment: '', icon: Server },
        { name: 'Members', segment: 'members', icon: Users },
        { name: 'Roles', segment: 'roles', icon: ShieldCheck },
        { name: 'Channels', segment: 'channels', icon: Hash },
        { name: 'Sync', segment: 'sync', icon: RefreshCw },
      ],
    },
  },
  {
    label: 'Projects',
    items: [
      { name: 'All projects', route: '/dashboard/projects', icon: FolderKanban, exact: true },
    ],
    context: {
      kind: 'project',
      base: '/dashboard/projects',
      noun: 'project',
      list: { name: 'Projects', route: '/dashboard/projects' },
      subItems: [
        { name: 'Keys & settings', segment: '', icon: KeyRound },
        { name: 'Server access', segment: 'access', icon: Network },
        { name: 'Webhooks', segment: 'webhooks', icon: Webhook },
        { name: 'Inbound webhooks', segment: 'inbound-webhooks', icon: Inbox },
      ],
    },
  },
  {
    label: 'System',
    items: [
      { name: 'Monitoring', route: '/dashboard/monitoring', icon: Activity },
      { name: 'Settings', route: '/dashboard/settings', icon: Settings },
    ],
  },
];

/** The server or project in the URL, and the page within it; null outside one. */
export function contextFromPath(
  pathname: string,
  base: string
): { id: string; segment: string } | null {
  if (!pathname.startsWith(`${base}/`)) return null;
  const [id, segment = ''] = pathname.slice(base.length + 1).split('/');
  return id ? { id: decodeURIComponent(id), segment } : null;
}

export function contextHref(base: string, id: string, segment: string): string {
  const root = `${base}/${encodeURIComponent(id)}`;
  return segment ? `${root}/${segment}` : root;
}

/**
 * Where switching to another server or project goes: the same page for the
 * new one. Anything deeper (a role, a sync run) belongs to the old one, so
 * it is dropped.
 */
export function switchTarget(pathname: string, base: string, id: string): string {
  return contextHref(base, id, contextFromPath(pathname, base)?.segment ?? '');
}

export function isLinkActive(pathname: string, link: NavLink): boolean {
  if (link.exact) return pathname === link.route;
  return pathname === link.route || pathname.startsWith(`${link.route}/`);
}
