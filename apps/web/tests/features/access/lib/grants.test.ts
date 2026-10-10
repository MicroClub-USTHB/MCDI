import { ACCESS_RESOURCES } from '@mcdi/contracts';
import { describe, expect, it } from 'vitest';

import {
  draftFromGrants,
  grantsPayload,
  isDirty,
  loweredOverrides,
  loweredResources,
  overridesPayload,
} from '@/features/access/lib/grants';

describe('role drafts', () => {
  it('starts from the grants with every other resource none', () => {
    const draft = draftFromGrants({ members: 'read', projects: 'manage' });

    expect(Object.keys(draft)).toEqual([...ACCESS_RESOURCES]);
    expect(draft.members).toBe('read');
    expect(draft.projects).toBe('manage');
    expect(draft.messages).toBe('none');
  });

  it('leaves none out of the payload', () => {
    const draft = {
      ...draftFromGrants({}),
      members: 'read',
      audit: 'none',
    } as ReturnType<typeof draftFromGrants>;
    expect(grantsPayload(draft)).toEqual({ members: 'read' });
  });

  it('detects a change', () => {
    const saved = draftFromGrants({ members: 'read' });
    expect(isDirty(saved, draftFromGrants({ members: 'read' }))).toBe(false);
    expect(isDirty(saved, draftFromGrants({ members: 'write' }))).toBe(true);
  });

  it('lists the resources whose level goes down, and not the ones that go up or stay', () => {
    const before = draftFromGrants({ members: 'manage', audit: 'read', stats: 'read' });
    const after = draftFromGrants({
      members: 'read',
      audit: 'none',
      stats: 'write',
      sync: 'read',
    });

    expect(loweredResources(before, after)).toEqual(['members', 'audit']);
  });
});

describe('member overrides', () => {
  it('sends only the resources that are overridden, none included', () => {
    expect(overridesPayload({ messages: 'none', projects: 'manage' })).toEqual({
      messages: 'none',
      projects: 'manage',
    });
    expect(overridesPayload({})).toEqual({});
  });

  it('lowers when an override is below the current effective level, and not for inherit or a raise', () => {
    const effective = draftFromGrants({ members: 'write', stats: 'read', projects: 'manage' });

    expect(loweredOverrides(effective, { members: 'read', stats: 'write', audit: 'read' })).toEqual(
      ['members']
    );
    expect(loweredOverrides(effective, { messages: 'none' })).toEqual([]);
    expect(loweredOverrides(effective, { projects: 'none' })).toEqual(['projects']);
    expect(loweredOverrides(effective, {})).toEqual([]);
  });
});
