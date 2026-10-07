import {
  ANY_ACCESS,
  OPEN,
  ROOT_ONLY,
  allOf,
  anyOf,
  need,
  type Requirement,
} from '@/shared/lib/access';

interface RouteRule {
  /** `/dashboard/servers/[id]/roles`: `[param]` matches any one segment. */
  pattern: string;
  requires: Requirement;
}

const servers = need('servers', 'read');
const projects = need('projects', 'read');

/**
 * Who may open each dashboard page. Opening a page needs `read`; the actions on it are gated where
 * they are rendered. A page that is not listed here is denied, and a test fails when a `page.tsx`
 * has no entry. Pages that read several resources list the ones that make up the page (`allOf`);
 * data that only feeds a filter or a label degrades on the page instead.
 */
export const ROUTE_RULES: RouteRule[] = [
  { pattern: '/dashboard', requires: ANY_ACCESS },

  { pattern: '/dashboard/members', requires: need('members', 'read') },
  { pattern: '/dashboard/members/[discordId]', requires: need('members', 'read') },
  { pattern: '/dashboard/stats', requires: need('stats', 'read') },

  { pattern: '/dashboard/servers', requires: servers },
  { pattern: '/dashboard/servers/[id]', requires: servers },
  { pattern: '/dashboard/servers/[id]/members', requires: allOf(servers, need('members', 'read')) },
  {
    pattern: '/dashboard/servers/[id]/roles',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  {
    pattern: '/dashboard/servers/[id]/roles/[roleId]',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  {
    pattern: '/dashboard/servers/[id]/channels',
    requires: allOf(servers, need('channels', 'read')),
  },
  { pattern: '/dashboard/servers/[id]/sync', requires: allOf(servers, need('sync', 'read')) },
  {
    pattern: '/dashboard/servers/[id]/sync/logs/[syncLogId]',
    requires: allOf(servers, need('sync', 'read')),
  },

  // Old links that redirect into the last-used server or project.
  {
    pattern: '/dashboard/roles',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  {
    pattern: '/dashboard/roles/[roleId]',
    requires: allOf(servers, need('roles', 'read'), need('stats', 'read')),
  },
  { pattern: '/dashboard/channels', requires: allOf(servers, need('channels', 'read')) },
  { pattern: '/dashboard/sync', requires: allOf(servers, need('sync', 'read')) },
  {
    pattern: '/dashboard/sync/logs/[syncLogId]',
    requires: allOf(servers, need('sync', 'read')),
  },
  { pattern: '/dashboard/webhooks', requires: allOf(projects, need('webhooks', 'read')) },

  { pattern: '/dashboard/projects', requires: projects },
  { pattern: '/dashboard/projects/[id]', requires: projects },
  { pattern: '/dashboard/projects/[id]/access', requires: allOf(projects, servers) },
  {
    pattern: '/dashboard/projects/[id]/webhooks',
    requires: allOf(projects, need('webhooks', 'read')),
  },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks',
    requires: allOf(projects, need('inbound_webhooks', 'read')),
  },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks/new',
    requires: allOf(projects, need('inbound_webhooks', 'write')),
  },
  {
    pattern: '/dashboard/projects/[id]/inbound-webhooks/[webhookId]',
    requires: allOf(projects, need('inbound_webhooks', 'read')),
  },

  {
    pattern: '/dashboard/monitoring',
    requires: anyOf(need('monitoring', 'read'), need('audit', 'read')),
  },

  // The profile is always available. Every other section is gated where it is rendered.
  { pattern: '/dashboard/settings', requires: OPEN },
  { pattern: '/dashboard/settings/inbound-webhooks', requires: need('inbound_webhooks', 'read') },

  { pattern: '/dashboard/access', requires: ROOT_ONLY },
  { pattern: '/dashboard/members/[discordId]/access', requires: ROOT_ONLY },
];

function toRegExp(pattern: string): RegExp {
  const source = pattern
    .split('/')
    .map((segment) =>
      /^\[.+\]$/.test(segment) ? '[^/]+' : segment.replace(/[.*+?^${}()|\\]/g, '\\$&')
    )
    .join('/');
  return new RegExp(`^${source}$`);
}

const COMPILED = ROUTE_RULES.map((rule) => ({
  rule,
  regex: toRegExp(rule.pattern),
  dynamicSegments: (rule.pattern.match(/\[/g) ?? []).length,
}));

/** The requirement of the page at `pathname`, or null when no entry matches (the guard denies it). */
export function requirementForPath(pathname: string): Requirement | null {
  const clean = (pathname.split('?')[0] ?? '').replace(/\/+$/, '') || '/';
  const matches = COMPILED.filter(({ regex }) => regex.test(clean));
  if (matches.length === 0) return null;
  matches.sort((a, b) => a.dynamicSegments - b.dynamicSegments);
  return matches[0]!.rule.requires;
}
