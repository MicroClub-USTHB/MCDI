import { Test } from '@nestjs/testing';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { AdminAccessController } from './admin-access.controller';
import { AdminAccessGrantsService } from './admin-access-grants.service';

describe('AdminAccessController', () => {
  let controller: AdminAccessController;
  const grants = {
    getCatalog: jest.fn(),
    listRoles: jest.fn(),
    setRoleGrants: jest.fn(),
    getMemberOverrides: jest.fn(),
    setMemberOverrides: jest.fn(),
    removeMemberOverride: jest.fn(),
    getMemberEffective: jest.fn(),
  };
  const req = {
    memberId: 'actor-1',
    headers: { 'user-agent': 'jest' },
    ip: '203.0.113.7',
  } as never;
  const client = { ipAddress: '203.0.113.7', userAgent: 'jest' };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      controllers: [AdminAccessController],
      providers: [{ provide: AdminAccessGrantsService, useValue: grants }],
    })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AdminAccessController);
  });

  it('serves the catalog and the role list', async () => {
    grants.getCatalog.mockReturnValue({ resources: [], levels: [] });
    grants.listRoles.mockResolvedValue([{ id: 'r' }]);

    expect(controller.getCatalog()).toEqual({ resources: [], levels: [] });
    await expect(controller.listRoles()).resolves.toEqual([{ id: 'r' }]);
  });

  it('passes the acting admin and client info when setting role grants', async () => {
    grants.setRoleGrants.mockResolvedValue({ roleId: 'r', grants: {} });

    await controller.setRoleGrants('r', { grants: { members: 'read' } }, req);

    expect(grants.setRoleGrants).toHaveBeenCalledWith(
      'actor-1',
      'r',
      { members: 'read' },
      client,
    );
  });

  it('passes the acting admin when setting member overrides and removing one', async () => {
    grants.setMemberOverrides.mockResolvedValue({});
    grants.removeMemberOverride.mockResolvedValue(undefined);

    await controller.setMemberOverrides(
      'm',
      { grants: { messages: 'none' } },
      req,
    );
    await controller.removeMemberOverride('m', 'messages', req);

    expect(grants.setMemberOverrides).toHaveBeenCalledWith(
      'actor-1',
      'm',
      { messages: 'none' },
      client,
    );
    expect(grants.removeMemberOverride).toHaveBeenCalledWith(
      'actor-1',
      'm',
      'messages',
      client,
    );
  });

  it('reads a member overrides and effective access', async () => {
    grants.getMemberOverrides.mockResolvedValue({
      memberId: 'm',
      overrides: {},
    });
    grants.getMemberEffective.mockResolvedValue({ memberId: 'm', root: false });

    await expect(controller.getMemberOverrides('m')).resolves.toEqual({
      memberId: 'm',
      overrides: {},
    });
    await expect(controller.getMemberEffective('m')).resolves.toEqual({
      memberId: 'm',
      root: false,
    });
  });
});
