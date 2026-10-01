import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CheckMode } from './dto/check-permissions-batch.dto';

const mockPermissionsService = {
  checkPermission: jest.fn(),
  hasAllPermissions: jest.fn(),
  hasAnyPermission: jest.fn(),
  getMemberPermissions: jest.fn(),
  upsertInheritanceRule: jest.fn(),
  listInheritanceRules: jest.fn(),
  getRolePermissions: jest.fn(),
  assignPermissionsToRole: jest.fn(),
  removePermissionFromRole: jest.fn(),
  previewImpact: jest.fn(),
};

describe('PermissionsController', () => {
  let controller: PermissionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        { provide: PermissionsService, useValue: mockPermissionsService },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(PermissionsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('checkPermission delegates to service', async () => {
    mockPermissionsService.checkPermission.mockResolvedValue({ allowed: true });
    const dto = {
      serverId: 's1',
      discordId: 'u1',
      permission: 'READ_MEMBERS',
    } as any;
    const result = await controller.checkPermission(dto);
    expect(mockPermissionsService.checkPermission).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ allowed: true });
  });

  it('checkPermissionBatch calls hasAllPermissions when mode=ALL', async () => {
    mockPermissionsService.hasAllPermissions.mockResolvedValue({
      allowed: true,
    });
    const dto = {
      serverId: 's1',
      discordId: 'u1',
      permissions: ['READ'],
      mode: CheckMode.ALL,
    } as any;
    await controller.checkPermissionBatch(dto);
    expect(mockPermissionsService.hasAllPermissions).toHaveBeenCalledWith(
      's1',
      'u1',
      ['READ'],
    );
    expect(mockPermissionsService.hasAnyPermission).not.toHaveBeenCalled();
  });

  it('checkPermissionBatch calls hasAnyPermission when mode=ANY', async () => {
    mockPermissionsService.hasAnyPermission.mockResolvedValue({
      allowed: false,
    });
    const dto = {
      serverId: 's1',
      discordId: 'u1',
      permissions: ['READ'],
      mode: CheckMode.ANY,
    } as any;
    await controller.checkPermissionBatch(dto);
    expect(mockPermissionsService.hasAnyPermission).toHaveBeenCalledWith(
      's1',
      'u1',
      ['READ'],
    );
  });

  it('getMemberPermissions returns permission set from service', async () => {
    mockPermissionsService.getMemberPermissions.mockResolvedValue({
      permissions: ['READ'],
    });
    const result = await controller.getMemberPermissions('s1', 'u1');
    expect(mockPermissionsService.getMemberPermissions).toHaveBeenCalledWith(
      's1',
      'u1',
    );
    expect(result).toMatchObject({ permissions: ['READ'] });
  });

  it('upsertInheritanceRule delegates to service', async () => {
    mockPermissionsService.upsertInheritanceRule.mockResolvedValue({ id: 1 });
    const dto = { sourceRoleId: 'r1', targetRoleId: 'r2' } as any;
    await controller.upsertInheritanceRule(dto);
    expect(mockPermissionsService.upsertInheritanceRule).toHaveBeenCalledWith(
      dto,
    );
  });

  it('listInheritanceRules delegates to service', async () => {
    mockPermissionsService.listInheritanceRules.mockResolvedValue([]);
    await controller.listInheritanceRules({} as any);
    expect(mockPermissionsService.listInheritanceRules).toHaveBeenCalled();
  });

  it('getRolePermissions delegates to service', async () => {
    mockPermissionsService.getRolePermissions.mockResolvedValue({
      roleId: 'r1',
      permissions: [],
    });
    const result = await controller.getRolePermissions('s1', 'r1');
    expect(mockPermissionsService.getRolePermissions).toHaveBeenCalledWith(
      's1',
      'r1',
    );
    expect(result.roleId).toBe('r1');
  });

  it('assignPermissionsToRole delegates to service', async () => {
    mockPermissionsService.assignPermissionsToRole.mockResolvedValue({
      roleId: 'r1',
      permissions: [],
    });
    const dto = { permissionIds: [1, 2] } as any;
    const result = await controller.assignPermissionsToRole('s1', 'r1', dto);
    expect(mockPermissionsService.assignPermissionsToRole).toHaveBeenCalledWith(
      's1',
      'r1',
      dto,
    );
    expect(result.roleId).toBe('r1');
  });

  it('removePermissionFromRole delegates to service', async () => {
    mockPermissionsService.removePermissionFromRole.mockResolvedValue(
      undefined,
    );
    await controller.removePermissionFromRole('s1', 'r1', '5');
    expect(
      mockPermissionsService.removePermissionFromRole,
    ).toHaveBeenCalledWith('s1', 'r1', 5);
  });

  it('previewImpact delegates to service', async () => {
    mockPermissionsService.previewImpact.mockResolvedValue({
      affectedMembers: 3,
      memberIds: ['m1', 'm2', 'm3'],
      roleHolders: 3,
    });
    const dto = { permissionIds: [1], action: 'add' } as any;
    const result = await controller.previewImpact('s1', 'r1', dto);
    expect(mockPermissionsService.previewImpact).toHaveBeenCalledWith(
      's1',
      'r1',
      dto,
    );
    expect(result.affectedMembers).toBe(3);
  });
});
