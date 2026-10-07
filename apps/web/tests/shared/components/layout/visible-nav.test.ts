import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import type { AccessSubject, Permissions } from '@/shared/lib/access';
import { firstAllowedHref, visibleNavGroups } from '@/shared/components/layout/visible-nav';

const none = Object.fromEntries(ACCESS_RESOURCES.map((r) => [r, 'none'])) as Permissions;
const member = (permissions: Partial<Permissions>): AccessSubject => ({
  root: false,
  permissions: { ...none, ...permissions },
});
const root: AccessSubject = { root: true, permissions: none };

const names = (subject: AccessSubject | null) =>
  visibleNavGroups(subject).map((entry) => [
    entry.group.label,
    entry.items.map((item) => item.name),
    entry.context?.subItems.map((item) => item.name),
  ]);

describe('visibleNavGroups', () => {
  it('shows everything to root', () => {
    expect(names(root)).toEqual([
      ['Overview', ['Dashboard', 'Members', 'Stats'], undefined],
      ['Discord', [], ['Overview', 'Members', 'Roles', 'Channels', 'Sync']],
      [
        'Projects',
        ['All projects'],
        ['Keys & settings', 'Server access', 'Webhooks', 'Inbound webhooks'],
      ],
      ['System', ['Monitoring', 'Settings', 'Access'], undefined],
    ]);
  });

  it('shows Access to root only', () => {
    expect(names(member({ settings: 'manage', audit: 'manage' })).flat(2)).not.toContain('Access');
    expect(names(root).flat(2)).toContain('Access');
  });

  it('shows only Settings to a member with no access', () => {
    expect(names(member({}))).toEqual([['System', ['Settings'], undefined]]);
  });

  it('hides a context group whose list is not allowed, even when a sub-page is', () => {
    const entries = names(member({ channels: 'read' }));
    expect(entries.map(([label]) => label)).not.toContain('Discord');
  });

  it('filters the sub-items of a context by their own requirement', () => {
    const entries = visibleNavGroups(member({ servers: 'read', members: 'read', sync: 'read' }));
    const discord = entries.find((entry) => entry.group.label === 'Discord');
    expect(discord?.context?.subItems.map((item) => item.name)).toEqual([
      'Overview',
      'Members',
      'Sync',
    ]);
  });

  it('needs both servers and statistics to offer the Roles sub-page', () => {
    const withoutStats = visibleNavGroups(member({ servers: 'read', roles: 'read' }));
    const discord = withoutStats.find((entry) => entry.group.label === 'Discord');
    expect(discord?.context?.subItems.map((item) => item.name)).toEqual(['Overview']);
  });

  it('shows the Monitoring link when either monitoring or audit is readable', () => {
    expect(names(member({ audit: 'read' })).flat(2)).toContain('Monitoring');
  });
});

describe('firstAllowedHref', () => {
  it('points at the first page the member can open, or at Settings', () => {
    expect(firstAllowedHref(root)).toBe('/dashboard');
    expect(firstAllowedHref(member({ stats: 'read' }))).toBe('/dashboard');
    expect(firstAllowedHref(member({}))).toBe('/dashboard/settings');
    expect(firstAllowedHref(null)).toBe('/dashboard/settings');
  });
});
