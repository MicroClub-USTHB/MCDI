import { describe, it, expect } from 'vitest';

import { getBreadcrumbItems } from '@/shared/components/layout/use-breadcrumb-items';

describe('getBreadcrumbItems', () => {
  it('returns no items for the dashboard root — a single unlinked crumb is just noise there', () => {
    expect(getBreadcrumbItems('/dashboard')).toEqual([]);
  });

  it('resolves a known top-level route to its nav name', () => {
    expect(getBreadcrumbItems('/dashboard/servers')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Servers' },
    ]);
  });

  it('resolves a nested path under a known route to that route name', () => {
    expect(getBreadcrumbItems('/dashboard/servers/123')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Servers' },
    ]);
  });

  it('falls back to a title-cased trailing segment for unknown routes', () => {
    expect(getBreadcrumbItems('/dashboard/some-unknown-page')).toEqual([
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Some Unknown Page' },
    ]);
  });
});
