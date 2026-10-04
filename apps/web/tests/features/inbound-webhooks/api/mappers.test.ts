import { describe, expect, it } from 'vitest';

import {
  buildRoleOptions,
  isValidSlug,
  mapInboundWebhook,
  parseOrigins,
  slugify,
  toCreatePayload,
} from '@/features/inbound-webhooks/api/mappers';
import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';

const dto: InboundWebhookDto = {
  id: 'wh_1',
  projectId: 'proj_1',
  name: 'Recruitment 2026',
  slug: 'recruitment-2026',
  schema: { version: 1, steps: [] },
  acceptedOrigins: [],
  requireSignature: true,
  rejectUnknownFields: true,
  allowRoleInheritance: false,
  isActive: true,
  submissionCount: 1234,
  lastSubmissionAt: '2026-10-01T09:30:00.000Z',
  createdAt: '2026-09-01T10:00:00.000Z',
  updatedAt: '2026-09-01T10:00:00.000Z',
};

describe('mapInboundWebhook', () => {
  it('labels what the list shows', () => {
    const view = mapInboundWebhook(dto);

    expect(view).toMatchObject({
      id: 'wh_1',
      name: 'Recruitment 2026',
      slug: 'recruitment-2026',
      isActive: true,
      signatureLabel: 'Signed',
      submissionCount: 1234,
    });
    expect(view.lastSubmissionLabel).not.toBe('Never');
  });

  it('says so when it is unsigned or has never received anything', () => {
    const view = mapInboundWebhook({
      ...dto,
      requireSignature: false,
      lastSubmissionAt: null,
    });

    expect(view.signatureLabel).toBe('Unsigned');
    expect(view.lastSubmissionLabel).toBe('Never');
  });
});

describe('slugify', () => {
  it.each([
    ['Recruitment 2026', 'recruitment-2026'],
    ['  Workshop   Sign-up!  ', 'workshop-sign-up'],
    ['Été & Fête', 'ete-fete'],
    ['---a---b---', 'a-b'],
    ['UPPER_case name', 'upper-case-name'],
    ['', ''],
    ['!!!', ''],
  ])('turns %j into %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('keeps a slug within the length the API accepts', () => {
    const slug = slugify('a'.repeat(200));

    expect(slug.length).toBeLessThanOrEqual(64);
    expect(isValidSlug(slug)).toBe(true);
  });

  it('never ends with a dash after being cut short', () => {
    const slug = slugify(`${'a'.repeat(63)} b`);

    expect(slug.endsWith('-')).toBe(false);
  });
});

describe('isValidSlug', () => {
  it.each(['ab', 'recruitment-2026', 'a1', 'x-y-z'])('accepts %j', (slug) => {
    expect(isValidSlug(slug)).toBe(true);
  });

  it.each(['', 'a', '-ab', 'ab-', 'Ab', 'a b', 'a_b', 'a'.repeat(65)])('rejects %j', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe('parseOrigins', () => {
  it('reads one origin per line or separated by commas, once each', () => {
    expect(parseOrigins('https://a.dz\n https://b.dz ,https://a.dz,,\n')).toEqual([
      'https://a.dz',
      'https://b.dz',
    ]);
  });

  it('is empty for blank input', () => {
    expect(parseOrigins('  \n ')).toEqual([]);
  });
});

describe('toCreatePayload', () => {
  const form = {
    name: '  Recruitment ',
    slug: 'recruitment',
    schema: { version: 1, steps: [] },
    allowedRoleIds: ['r1', 'r2'],
    origins: 'https://a.dz',
    requireSignature: true,
    rejectUnknownFields: false,
  };

  it('builds the request for the project', () => {
    expect(toCreatePayload('proj_1', form)).toEqual({
      projectId: 'proj_1',
      name: 'Recruitment',
      slug: 'recruitment',
      schema: { version: 1, steps: [] },
      allowedRoleIds: ['r1', 'r2'],
      acceptedOrigins: ['https://a.dz'],
      requireSignature: true,
      rejectUnknownFields: false,
    });
  });

  it('always names the roles, so the webhook gets exactly what was chosen', () => {
    expect(toCreatePayload('p', { ...form, allowedRoleIds: [] })).toHaveProperty(
      'allowedRoleIds',
      []
    );
  });
});

describe('buildRoleOptions', () => {
  const servers = [
    {
      serverId: 's1',
      serverName: 'Events',
      roles: [
        { roleId: 'r1', roleName: 'Member' },
        { roleId: 'r2', roleName: 'Lead' },
      ],
    },
  ];
  const defaults = [{ id: 'rx', name: 'MC Executive', serverId: 'main', serverName: 'MCDI' }];

  it('offers the roles of the given servers, grouped by server', () => {
    const options = buildRoleOptions(servers, []);

    expect(options.map((o) => [o.id, o.name, o.serverName])).toEqual([
      ['r1', 'Member', 'Events'],
      ['r2', 'Lead', 'Events'],
    ]);
  });

  it('adds the default reader roles even from a server the project cannot use', () => {
    const options = buildRoleOptions(servers, defaults);

    expect(options.find((o) => o.id === 'rx')).toMatchObject({
      name: 'MC Executive',
      serverName: 'MCDI',
      isDefault: true,
    });
  });

  it('marks a default role once when it is also on a project server', () => {
    const options = buildRoleOptions(servers, [
      { id: 'r2', name: 'Lead', serverId: 's1', serverName: 'Events' },
    ]);

    expect(options.filter((o) => o.id === 'r2')).toHaveLength(1);
    expect(options.find((o) => o.id === 'r2')?.isDefault).toBe(true);
    expect(options.find((o) => o.id === 'r1')?.isDefault).toBe(false);
  });
});
