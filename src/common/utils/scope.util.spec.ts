import { ForbiddenException } from '@nestjs/common';
import { validateScope } from './scope.util';

const buildMockDb = (rows: unknown[]) => ({
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue(rows),
});

describe('validateScope', () => {
  it('resolves without throwing when the scope is present in project_servers.scopes', async () => {
    const db = buildMockDb([
      { scopes: ['read_members', 'check_permissions'] },
    ]);
    await expect(
      validateScope(db as any, 'proj-1', 'server-1', 'read_members'),
    ).resolves.toBeUndefined();
  });

  it('throws ForbiddenException when the scope is missing from project_servers.scopes', async () => {
    const db = buildMockDb([{ scopes: ['read_members'] }]);
    await expect(
      validateScope(db as any, 'proj-1', 'server-1', 'write_webhooks'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when no project-server mapping exists', async () => {
    const db = buildMockDb([]);
    await expect(
      validateScope(db as any, 'proj-1', 'server-1', 'read_members'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('includes the scope name in the error message', async () => {
    const db = buildMockDb([]);
    await expect(
      validateScope(db as any, 'proj-1', 'server-1', 'manage_bots'),
    ).rejects.toThrow(/manage_bots/);
  });
});
