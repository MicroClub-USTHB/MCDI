import { describe, it, expect } from 'vitest';

import { getBreadcrumbItems } from '@/shared/components/layout/use-breadcrumb-items';

const names = {
  server: new Map([['srv_1', 'MicroClub']]),
  project: new Map([['proj_1', 'Website']]),
};

describe('getBreadcrumbItems', () => {
  it('returns no items for the dashboard root — a single unlinked crumb is just noise there', () => {
    expect(getBreadcrumbItems('/dashboard')).toEqual([]);
  });

  it('names a top-level page', () => {
    expect(getBreadcrumbItems('/dashboard/stats')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Stats' },
    ]);
  });

  it('keeps a detail page under its top-level page', () => {
    expect(getBreadcrumbItems('/dashboard/members/42')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Members' },
    ]);
  });

  it('names the server list', () => {
    expect(getBreadcrumbItems('/dashboard/servers')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Servers' },
    ]);
  });

  it("names a server's overview by the server", () => {
    expect(getBreadcrumbItems('/dashboard/servers/srv_1', names)).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Servers', href: '/dashboard/servers' },
      { label: 'MicroClub' },
    ]);
  });

  it('shows the server and the page within it', () => {
    expect(getBreadcrumbItems('/dashboard/servers/srv_1/roles/42', names)).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Servers', href: '/dashboard/servers' },
      { label: 'MicroClub', href: '/dashboard/servers/srv_1' },
      { label: 'Roles' },
    ]);
  });

  it('shows the project and the page within it', () => {
    expect(getBreadcrumbItems('/dashboard/projects/proj_1/webhooks', names)).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Projects', href: '/dashboard/projects' },
      { label: 'Website', href: '/dashboard/projects/proj_1' },
      { label: 'Webhooks' },
    ]);
  });

  it('keeps the create page under the inbound webhooks crumb', () => {
    expect(getBreadcrumbItems('/dashboard/projects/proj_1/inbound-webhooks/new', names)).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Projects', href: '/dashboard/projects' },
      { label: 'Website', href: '/dashboard/projects/proj_1' },
      { label: 'Inbound webhooks' },
    ]);
  });

  it('falls back to a generic name until the server list has loaded', () => {
    expect(getBreadcrumbItems('/dashboard/servers/srv_9/sync')[2]).toEqual({
      label: 'Server',
      href: '/dashboard/servers/srv_9',
    });
  });

  it('falls back to a title-cased trailing segment for unknown routes', () => {
    expect(getBreadcrumbItems('/dashboard/some-unknown-page')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Some Unknown Page' },
    ]);
  });
});
