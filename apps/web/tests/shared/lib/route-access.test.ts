import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ROUTE_RULES, requirementForPath } from '@/shared/lib/route-access';
import { ANY_ACCESS, ROOT_ONLY, allOf, need } from '@/shared/lib/access';

const DASHBOARD = path.resolve(__dirname, '../../../src/app/dashboard');

/** `/dashboard/servers/[id]/roles` for every `page.tsx` under `app/dashboard`. */
function pagePatterns(dir = DASHBOARD, prefix = '/dashboard'): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory())
      return pagePatterns(path.join(dir, entry.name), `${prefix}/${entry.name}`);
    return entry.name === 'page.tsx' ? [prefix] : [];
  });
}

describe('the route table', () => {
  it('has an entry for every dashboard page, and no stale entry', () => {
    const pages = pagePatterns().sort();
    const patterns = ROUTE_RULES.map((rule) => rule.pattern).sort();

    expect(pages.length).toBeGreaterThan(20);
    expect(patterns).toEqual(pages);
  });

  it('has no duplicate pattern', () => {
    const patterns = ROUTE_RULES.map((rule) => rule.pattern);
    expect(new Set(patterns).size).toBe(patterns.length);
  });
});

describe('requirementForPath', () => {
  it('matches a static page', () => {
    expect(requirementForPath('/dashboard/stats')).toEqual(need('stats', 'read'));
    expect(requirementForPath('/dashboard')).toEqual(ANY_ACCESS);
  });

  it('matches a dynamic page with any id, ignoring a trailing slash and a query', () => {
    expect(requirementForPath('/dashboard/servers/123/roles/456/')).toEqual(
      allOf(need('servers', 'read'), need('roles', 'read'), need('stats', 'read'))
    );
    expect(requirementForPath('/dashboard/projects/abc?tab=1')).toEqual(need('projects', 'read'));
  });

  it('prefers the more specific pattern', () => {
    expect(requirementForPath('/dashboard/projects/p1/inbound-webhooks/new')).toEqual(
      allOf(need('projects', 'read'), need('inbound_webhooks', 'write'))
    );
    expect(requirementForPath('/dashboard/projects/p1/inbound-webhooks/w1')).toEqual(
      allOf(need('projects', 'read'), need('inbound_webhooks', 'read'))
    );
  });

  it('returns null for a route that is not in the table', () => {
    expect(requirementForPath('/dashboard/nope')).toBeNull();
    expect(requirementForPath('/dashboard/servers/1/unknown')).toBeNull();
  });

  it('does not grant by prefix', () => {
    expect(requirementForPath('/dashboard/stats/extra')).toBeNull();
  });

  it('keeps the root-only pages root only', () => {
    // Added to the table by the Access screen (PR 3); this guards the helper itself.
    expect(ROOT_ONLY.kind).toBe('root');
  });
});
