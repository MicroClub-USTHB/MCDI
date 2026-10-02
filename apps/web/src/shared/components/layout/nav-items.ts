import {
  Activity,
  BarChart3,
  FolderKanban,
  Hash,
  LayoutDashboard,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { channels } from '@/features/channels';
import { members } from '@/features/members';
import { monitoring } from '@/features/monitoring';
import { projects } from '@/features/projects';
import { roles } from '@/features/roles';
import { servers } from '@/features/servers';
import { settings } from '@/features/settings';
import { stats } from '@/features/stats';
import { sync } from '@/features/sync';
import { webhooks } from '@/features/webhooks';

export interface NavItem {
  name: string;
  route: string;
  icon: LucideIcon;
}

/**
 * Sourced from each feature's barrel (`name` + `route`) so this list can't
 * drift from the routes those modules actually declare. Shared by `Sidebar`
 * (rendering) and `Breadcrumb` (labeling the current route) — one source of
 * truth for "what are the top-level dashboard routes."
 */
export const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', route: '/dashboard', icon: LayoutDashboard },
  { name: servers.name, route: servers.route, icon: Server },
  { name: members.name, route: members.route, icon: Users },
  { name: projects.name, route: projects.route, icon: FolderKanban },
  { name: roles.name, route: roles.route, icon: ShieldCheck },
  { name: channels.name, route: channels.route, icon: Hash },
  { name: webhooks.name, route: webhooks.route, icon: Webhook },
  { name: sync.name, route: sync.route, icon: RefreshCw },
  { name: stats.name, route: stats.route, icon: BarChart3 },
  { name: monitoring.name, route: monitoring.route, icon: Activity },
  { name: settings.name, route: settings.route, icon: Settings },
];
