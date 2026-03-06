import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectsAccessController } from './projects-access.controller';
import { ProjectsAccessService } from './projects-access.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockAccessService = {
  grantAccess: jest.fn(),
  revokeAccess: jest.fn(),
  listAccessMatrix: jest.fn(),
  listServersByProject: jest.fn(),
  listProjectsByServer: jest.fn(),
  listAudit: jest.fn(),
};

const mockReq = (user?: object) => ({ user }) as any;

describe('ProjectsAccessController', () => {
  let controller: ProjectsAccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsAccessController],
      providers: [
        { provide: ProjectsAccessService, useValue: mockAccessService },
      ],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ProjectsAccessController);
  });

  afterEach(() => jest.clearAllMocks());

  it('setProjectServerAccess calls grantAccess with IDs from params and actor from request', async () => {
    mockAccessService.grantAccess.mockResolvedValue({
      projectId: 'p1',
      serverId: 's1',
    });
    const dto = { operations: { READ: true } } as any;
    await controller.setProjectServerAccess('p1', 's1', dto, mockReq({ id: 'admin-1' }));
    expect(mockAccessService.grantAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        serverId: 's1',
        changedBy: 'admin-1',
      }),
    );
  });

  it('revokeProjectServerAccess calls revokeAccess', async () => {
    mockAccessService.revokeAccess.mockResolvedValue({ revoked: true });
    await controller.revokeProjectServerAccess(
      'p1',
      's1',
      mockReq({ email: 'admin@example.com' }),
    );
    expect(mockAccessService.revokeAccess).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'p1',
        serverId: 's1',
        changedBy: 'admin@example.com',
      }),
    );
  });

  it('revokeProjectServerAccess propagates NotFoundException', async () => {
    mockAccessService.revokeAccess.mockRejectedValue(new NotFoundException());
    await expect(
      controller.revokeProjectServerAccess('p1', 'bad', mockReq()),
    ).rejects.toThrow(NotFoundException);
  });

  it('listAccessMatrix delegates to service', async () => {
    mockAccessService.listAccessMatrix.mockResolvedValue([]);
    await controller.listAccessMatrix();
    expect(mockAccessService.listAccessMatrix).toHaveBeenCalled();
  });

  it('listServersByProject delegates to service', async () => {
    mockAccessService.listServersByProject.mockResolvedValue([]);
    await controller.listServersByProject('p1');
    expect(mockAccessService.listServersByProject).toHaveBeenCalledWith('p1');
  });

  it('listProjectsByServer delegates to service', async () => {
    mockAccessService.listProjectsByServer.mockResolvedValue([]);
    await controller.listProjectsByServer('s1');
    expect(mockAccessService.listProjectsByServer).toHaveBeenCalledWith('s1');
  });

  it('listAccessAudit applies safe limit and delegates to service', async () => {
    mockAccessService.listAudit.mockResolvedValue([]);
    await controller.listAccessAudit(50);
    expect(mockAccessService.listAudit).toHaveBeenCalledWith(50);
  });

  it('listAccessAudit defaults to 100 when limit is undefined', async () => {
    mockAccessService.listAudit.mockResolvedValue([]);
    await controller.listAccessAudit(undefined);
    expect(mockAccessService.listAudit).toHaveBeenCalledWith(100);
  });
});
