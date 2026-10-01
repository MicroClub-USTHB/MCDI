import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { InboundWebhookReadGuard } from './inbound-webhook-read.guard';

const WEBHOOK = 'wh-1';
const MEMBER = 'member-1';

const ctx = (req: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

describe('InboundWebhookReadGuard', () => {
  let repository: { findMemberRoleIds: jest.Mock };
  let service: {
    getAllowedRoleIdsCached: jest.Mock;
    auditReadDenied: jest.Mock;
  };
  let guard: InboundWebhookReadGuard;

  beforeEach(() => {
    repository = { findMemberRoleIds: jest.fn().mockResolvedValue([]) };
    service = {
      getAllowedRoleIdsCached: jest.fn().mockResolvedValue([]),
      auditReadDenied: jest.fn().mockResolvedValue(undefined),
    };
    guard = new InboundWebhookReadGuard(repository as never, service as never);
  });

  const request = () => ({ memberId: MEMBER, params: { id: WEBHOOK } });

  it('allows a member holding a granted role', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a', 'role-b']);
    repository.findMemberRoleIds.mockResolvedValue(['role-z', 'role-b']);

    const req = request();
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect((req as Record<string, unknown>).matchedViaRoleId).toBe('role-b');
  });

  it('denies a member holding none of the granted roles', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a']);
    repository.findMemberRoleIds.mockResolvedValue(['role-z']);

    await expect(guard.canActivate(ctx(request()))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies with 404 rather than 403 — no enumeration oracle', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a']);
    repository.findMemberRoleIds.mockResolvedValue([]);

    await expect(guard.canActivate(ctx(request()))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('audits the denial before hiding the resource', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a']);
    repository.findMemberRoleIds.mockResolvedValue([]);

    await expect(guard.canActivate(ctx(request()))).rejects.toThrow();
    expect(service.auditReadDenied).toHaveBeenCalledWith(WEBHOOK, MEMBER);
  });

  it('does not let an admin role bypass the grants', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a']);
    repository.findMemberRoleIds.mockResolvedValue(['role-exec']);

    await expect(guard.canActivate(ctx(request()))).rejects.toMatchObject({
      status: 404,
    });
    expect(service.auditReadDenied).toHaveBeenCalledWith(WEBHOOK, MEMBER);
  });

  it('denies once a role has been revoked', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-a']);
    repository.findMemberRoleIds.mockResolvedValue(['role-a']);
    await expect(guard.canActivate(ctx(request()))).resolves.toBe(true);

    // The grant is withdrawn; the member's own roles are never cached, so the
    // next request sees the change immediately.
    service.getAllowedRoleIdsCached.mockResolvedValue(['role-b']);
    await expect(guard.canActivate(ctx(request()))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies when the webhook grants no roles at all (fail-closed)', async () => {
    service.getAllowedRoleIdsCached.mockResolvedValue([]);
    repository.findMemberRoleIds.mockResolvedValue(['role-a', 'role-b']);

    await expect(guard.canActivate(ctx(request()))).rejects.toThrow(
      NotFoundException,
    );
  });

  it('denies when there is no session member', async () => {
    await expect(
      guard.canActivate(ctx({ params: { id: WEBHOOK } })),
    ).rejects.toThrow(NotFoundException);
    expect(service.getAllowedRoleIdsCached).not.toHaveBeenCalled();
  });

  it('denies when the route carries no webhook id', async () => {
    await expect(
      guard.canActivate(ctx({ memberId: MEMBER, params: {} })),
    ).rejects.toThrow(NotFoundException);
  });
});
