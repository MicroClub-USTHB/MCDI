import { describe, expect, it } from 'vitest';

import {
  NAV_GROUPS,
  contextFromPath,
  contextHref,
  isLinkActive,
  switchTarget,
} from '@/shared/components/layout/nav-items';

const SERVERS = '/dashboard/servers';

describe('nav groups', () => {
  it('separates the overview, Discord, project and system views', () => {
    expect(NAV_GROUPS.map((group) => group.label)).toEqual([
      'Overview',
      'Discord',
      'Projects',
      'System',
    ]);
  });

  it('puts the Discord pages under a server and the project pages under a project', () => {
    const [, discord, projects] = NAV_GROUPS;
    expect(discord?.context?.subItems.map((item) => item.name)).toEqual([
      'Overview',
      'Members',
      'Roles',
      'Channels',
      'Sync',
    ]);
    expect(projects?.context?.subItems.map((item) => item.name)).toEqual([
      'Keys & settings',
      'Server access',
      'Webhooks',
    ]);
  });
});

describe('contextFromPath', () => {
  it('reads the server and the page within it', () => {
    expect(contextFromPath(`${SERVERS}/123/roles/456`, SERVERS)).toEqual({
      id: '123',
      segment: 'roles',
    });
    expect(contextFromPath(`${SERVERS}/123`, SERVERS)).toEqual({ id: '123', segment: '' });
  });

  it('is null outside a server, including the server list itself', () => {
    expect(contextFromPath(SERVERS, SERVERS)).toBeNull();
    expect(contextFromPath('/dashboard/members', SERVERS)).toBeNull();
  });
});

describe('contextHref', () => {
  it('builds the overview and the sub-pages', () => {
    expect(contextHref(SERVERS, '123', '')).toBe('/dashboard/servers/123');
    expect(contextHref(SERVERS, '123', 'sync')).toBe('/dashboard/servers/123/sync');
  });
});

describe('switchTarget', () => {
  it('keeps the same page when switching server', () => {
    expect(switchTarget(`${SERVERS}/123/channels`, SERVERS, '456')).toBe(
      '/dashboard/servers/456/channels'
    );
  });

  it('drops what belongs to the old server, such as a role or a sync run', () => {
    expect(switchTarget(`${SERVERS}/123/roles/789`, SERVERS, '456')).toBe(
      '/dashboard/servers/456/roles'
    );
  });

  it('opens the overview when switching from outside a server', () => {
    expect(switchTarget('/dashboard/stats', SERVERS, '456')).toBe('/dashboard/servers/456');
  });
});

describe('isLinkActive', () => {
  const members = { name: 'Members', route: '/dashboard/members', icon: () => null };

  it('matches the page and its detail pages', () => {
    expect(isLinkActive('/dashboard/members', members)).toBe(true);
    expect(isLinkActive('/dashboard/members/42', members)).toBe(true);
  });

  it("does not match a server's own member roster", () => {
    expect(isLinkActive('/dashboard/servers/1/members', members)).toBe(false);
  });

  it('matches exact links only exactly', () => {
    const all = { ...members, route: '/dashboard/projects', exact: true };
    expect(isLinkActive('/dashboard/projects', all)).toBe(true);
    expect(isLinkActive('/dashboard/projects/abc', all)).toBe(false);
  });
});
