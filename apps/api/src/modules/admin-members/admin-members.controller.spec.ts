import { Test, TestingModule } from '@nestjs/testing';
import { AdminMembersController } from './admin-members.controller';
import { AdminMembersService } from './admin-members.service';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';

const mockAdminMembersService = {
  getMemberCrossServerView: jest.fn(),
  getCrossServerList: jest.fn(),
  getExportData: jest.fn(),
};

const mockRes = () => ({
  setHeader: jest.fn(),
  send: jest.fn(),
  json: jest.fn(),
});

describe('AdminMembersController', () => {
  let controller: AdminMembersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminMembersController],
      providers: [
        { provide: AdminMembersService, useValue: mockAdminMembersService },
      ],
    })
      .overrideGuard(AdminAccessGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AdminMembersController);
  });

  afterEach(() => jest.clearAllMocks());

  it('getMemberServers delegates to adminMembersService', async () => {
    mockAdminMembersService.getMemberCrossServerView.mockResolvedValue({
      memberId: 'u1',
    });
    const result = await controller.getMemberServers('u1');
    expect(
      mockAdminMembersService.getMemberCrossServerView,
    ).toHaveBeenCalledWith('u1');
    expect(result).toMatchObject({ memberId: 'u1' });
  });

  it('getMemberList returns paginated list', async () => {
    mockAdminMembersService.getCrossServerList.mockResolvedValue({
      data: [],
      total: 0,
    });
    const result = await controller.getMemberList({
      filter: 'all',
      serverId: 's1',
      roleId: 'r1',
      page: 1,
      limit: 20,
    } as any);
    expect(mockAdminMembersService.getCrossServerList).toHaveBeenCalledWith({
      filter: 'all',
      serverId: 's1',
      roleId: 'r1',
      page: 1,
      limit: 20,
    });
    expect(result).toMatchObject({ total: 0 });
  });

  it('getCrossServerList returns paginated list', async () => {
    mockAdminMembersService.getCrossServerList.mockResolvedValue({
      data: [],
      total: 0,
    });
    const result = await controller.getCrossServerList({
      filter: 'all',
      serverId: 's1',
      page: 1,
      limit: 20,
    } as any);
    expect(result).toMatchObject({ total: 0 });
  });

  it('exportMembers sends CSV when format=csv and passes filters', async () => {
    mockAdminMembersService.getExportData.mockResolvedValue([
      {
        discord_id: 'u1',
        username: 'alice',
        server_id: 's1',
        server_name: 'Main',
        is_club_member: true,
        is_main_server: true,
        joined_at: '',
        roles: '',
      },
    ]);
    const res = mockRes();
    await controller.exportMembers(
      { filter: 'club', serverId: 's1', roleId: 'r1', format: 'csv' } as any,
      res as any,
    );
    expect(mockAdminMembersService.getExportData).toHaveBeenCalledWith({
      filter: 'club',
      serverId: 's1',
      roleId: 'r1',
      format: 'csv',
    });
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.send).toHaveBeenCalled();
  });

  it('exportMembers sends JSON when format=json', async () => {
    mockAdminMembersService.getExportData.mockResolvedValue([]);
    const res = mockRes();
    await controller.exportMembers(
      { filter: 'all', format: 'json' } as any,
      res as any,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/json',
    );
    expect(res.json).toHaveBeenCalled();
  });
});
