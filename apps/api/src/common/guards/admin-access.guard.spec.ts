import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  AdminSessionOnly,
  RequirePermission,
  RootOnly,
} from '../decorators/admin-access.decorator';
import { AdminAccessGuard } from './admin-access.guard';
import { validateSession } from '../utils/auth.util';
import { ACCESS_RESOURCES } from '../permissions/catalog';
import { resolveEffectiveAccess } from '../permissions/resolve-access';

jest.mock('../utils/auth.util', () => ({
  ...jest.requireActual('../utils/auth.util'),
  validateSession: jest.fn(),
}));

class Sample {
  @RequirePermission('members', 'write')
  needsWrite() {}

  @AdminSessionOnly()
  sessionOnly() {}

  @RootOnly()
  rootOnly() {}

  undeclared() {}
}

@RequirePermission('stats', 'read')
class ClassLevel {
  inherits() {}

  @RequirePermission('stats', 'manage')
  overrides() {}
}

function contextFor(
  cls: new () => object,
  method: string,
  headers: Record<string, string> = { authorization: 'Bearer tok' },
) {
  const request: Record<string, unknown> = { headers, cookies: {} };
  const handler = (cls.prototype as Record<string, () => void>)[method];
  const context = {
    getHandler: () => handler,
    getClass: () => cls,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AdminAccessGuard', () => {
  const access = { getEffectiveAccess: jest.fn() };
  const guard = new AdminAccessGuard(
    {} as never,
    new Reflector(),
    access as never,
  );
  const validate = validateSession as jest.Mock;

  const grant = (resource: string, level: 'read' | 'write' | 'manage') =>
    resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [{ roleId: 'r', resource: resource as never, level }],
      overrides: [],
    });

  beforeEach(() => {
    jest.resetAllMocks();
    validate.mockResolvedValue('member-1');
  });

  it('fails closed on a handler with no declared requirement, before touching the session', async () => {
    const { context } = contextFor(Sample, 'undeclared');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
    expect(validate).not.toHaveBeenCalled();
  });

  it('answers 401 when no session token is sent', async () => {
    const { context } = contextFor(Sample, 'needsWrite', {});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('validates an admin-only session and records the member on the request', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'write'),
    });
    const { context, request } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(validate).toHaveBeenCalledWith({}, 'tok', { adminOnly: true });
    expect(request.memberId).toBe('member-1');
  });

  it('allows a level above the required one (manage satisfies write)', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'manage'),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuses a level below the required one and names the resource and level', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('members', 'read'),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Requires 'write' access on 'members'",
    );
  });

  it('refuses a member with no grant at all on the resource', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: resolveEffectiveAccess({
        isRoot: false,
        roleGrants: [],
        overrides: [],
      }),
    });
    const { context } = contextFor(Sample, 'needsWrite');

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('lets any valid admin session through a session-only handler without resolving access', async () => {
    const { context } = contextFor(Sample, 'sessionOnly');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(access.getEffectiveAccess).not.toHaveBeenCalled();
  });

  it('lets only root through a root-only handler', async () => {
    const all = resolveEffectiveAccess({
      isRoot: true,
      roleGrants: [],
      overrides: [],
    });
    access.getEffectiveAccess.mockResolvedValueOnce({
      root: true,
      access: all,
    });
    await expect(
      guard.canActivate(contextFor(Sample, 'rootOnly').context),
    ).resolves.toBe(true);

    const manageEverything = Object.fromEntries(
      ACCESS_RESOURCES.map((r) => [
        r,
        { level: 'manage', source: { type: 'override' } },
      ]),
    );
    access.getEffectiveAccess.mockResolvedValueOnce({
      root: false,
      access: manageEverything,
    });
    await expect(
      guard.canActivate(contextFor(Sample, 'rootOnly').context),
    ).rejects.toThrow(ForbiddenException);
  });

  it('uses a class-level requirement when the handler declares none, and lets the handler override it', async () => {
    access.getEffectiveAccess.mockResolvedValue({
      root: false,
      access: grant('stats', 'read'),
    });

    await expect(
      guard.canActivate(contextFor(ClassLevel, 'inherits').context),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(ClassLevel, 'overrides').context),
    ).rejects.toThrow("Requires 'manage' access on 'stats'");
  });
});
