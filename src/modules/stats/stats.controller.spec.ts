import { Test, TestingModule } from '@nestjs/testing';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockStatsService = {
  getMemberStats: jest.fn(),
  getMemberGrowth: jest.fn(),
  getRoleStats: jest.fn(),
  getServerStats: jest.fn(),
};

describe('StatsController', () => {
  let controller: StatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: mockStatsService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(StatsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('getMemberStats delegates to the service', async () => {
    const expected = { totalMembers: 1 };
    mockStatsService.getMemberStats.mockResolvedValue(expected);
    const dto = { dateRange: '30d' } as any;
    await expect(controller.getMemberStats(dto)).resolves.toBe(expected);
    expect(mockStatsService.getMemberStats).toHaveBeenCalledWith(dto);
  });

  it('getMemberGrowth delegates to the service', async () => {
    const expected = { data: [], period: '30d', totalGrowth: 0 };
    mockStatsService.getMemberGrowth.mockResolvedValue(expected);
    const dto = { period: '30d', granularity: 'daily' } as any;
    await expect(controller.getMemberGrowth(dto)).resolves.toBe(expected);
    expect(mockStatsService.getMemberGrowth).toHaveBeenCalledWith(dto);
  });

  it('getRoleStats delegates to the service (scoped and cross-server)', async () => {
    const scopedExpected = { serverId: 's1', roles: [] };
    mockStatsService.getRoleStats.mockResolvedValue(scopedExpected);
    const scopedDto = { serverId: 's1' } as any;
    await expect(controller.getRoleStats(scopedDto)).resolves.toBe(
      scopedExpected,
    );
    expect(mockStatsService.getRoleStats).toHaveBeenCalledWith(scopedDto);

    const crossServerExpected = { serverId: null, roles: [] };
    mockStatsService.getRoleStats.mockResolvedValue(crossServerExpected);
    const crossServerDto = {} as any;
    await expect(controller.getRoleStats(crossServerDto)).resolves.toBe(
      crossServerExpected,
    );
    expect(mockStatsService.getRoleStats).toHaveBeenCalledWith(crossServerDto);
  });

  it('getServerStats delegates to the service', async () => {
    const expected = { servers: [], totalServers: 0, totalMembers: 0 };
    mockStatsService.getServerStats.mockResolvedValue(expected);
    await expect(controller.getServerStats()).resolves.toBe(expected);
    expect(mockStatsService.getServerStats).toHaveBeenCalled();
  });
});
