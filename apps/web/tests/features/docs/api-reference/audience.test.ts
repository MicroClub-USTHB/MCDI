import { describe, expect, it } from 'vitest';

import { audienceOf } from '@/features/docs/api-reference/audience';
import type { Operation } from '@/features/docs/api-reference/types';

const op = (security?: Record<string, string[]>[]): Operation => ({ operationId: 'X_y', security });

describe('audienceOf', () => {
  it('puts an operation that takes a project API key in the project API', () => {
    expect(audienceOf('/api/channels', op([{ 'api-key': [] }]))).toBe('project');
  });

  it('puts an operation that needs an admin session in the admin API', () => {
    expect(audienceOf('/api/servers', op([{ 'session-token': [] }]))).toBe('admin');
  });

  it('prefers the project API when an operation accepts either, since a project can use it', () => {
    expect(audienceOf('/api/x', op([{ 'api-key': [] }, { 'session-token': [] }]))).toBe('project');
  });

  it('treats a public endpoint as part of the project API, since it is how a member logs in', () => {
    expect(audienceOf('/api/auth/sso/authorize', op())).toBe('project');
    expect(audienceOf('/api/auth/authorize', op([]))).toBe('project');
  });

  it('keeps the admin login and the maintenance job in the admin API even though they are public', () => {
    expect(audienceOf('/api/auth/admin/discord', op())).toBe('admin');
    expect(audienceOf('/api/auth/cleanup', op())).toBe('admin');
  });

  it('keeps a member session operation in the project API, although it takes a session token', () => {
    // The member's own session token (SessionGuard), not an admin session.
    expect(audienceOf('/api/auth/sessions', op([{ 'session-token': [] }]))).toBe('project');
    expect(audienceOf('/api/auth/sessions/{sessionId}', op([{ 'session-token': [] }]))).toBe(
      'project'
    );
    expect(audienceOf('/api/auth/token/refresh', op([{ 'session-token': [] }]))).toBe('project');
  });

  it('keeps the admin profile and logout in the admin API, under the same /api/auth prefix', () => {
    expect(audienceOf('/api/auth/admin/me', op([{ 'session-token': [] }]))).toBe('admin');
    expect(audienceOf('/api/auth/admin/logout', op([{ 'session-token': [] }]))).toBe('admin');
  });

  it('lets the scheme decide for every path outside /api/auth', () => {
    expect(audienceOf('/api/servers', op([{ 'session-token': [] }]))).toBe('admin');
    expect(audienceOf('/api/members/{id}', op([{ 'api-key': [] }]))).toBe('project');
  });

  it('does not mistake a look-alike path for an admin one', () => {
    expect(audienceOf('/api/auth/administrators', op())).toBe('project');
  });
});
