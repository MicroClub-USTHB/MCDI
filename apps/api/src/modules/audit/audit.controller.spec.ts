import { Test, TestingModule } from '@nestjs/testing';
import { AuditController, MonitoringController } from './audit.controller';
import { AuditService } from './audit.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockAuditService = {
  getAuditLogs: jest.fn(),
  getAuditLogsCsv: jest.fn(),
  getHealthStatus: jest.fn(),
  getUsageStats: jest.fn(),
};

describe('AuditController', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(AuditController);
  });

  afterEach(() => jest.clearAllMocks());

  it('getLogs delegates to the service', async () => {
    const expected = { logs: [], total: 0, limit: 50, offset: 0 };
    mockAuditService.getAuditLogs.mockResolvedValue(expected);
    const dto = { limit: 50, offset: 0 } as any;

    await expect(controller.getLogs(dto)).resolves.toBe(expected);
    expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(dto);
  });

  it('exportLogs streams a CSV with download headers', async () => {
    mockAuditService.getAuditLogsCsv.mockResolvedValue('id,timestamp\n1,now');
    const res = { setHeader: jest.fn(), send: jest.fn() };

    await controller.exportLogs({ limit: 50, offset: 0 } as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining('attachment; filename="audit-logs-'),
    );
    expect(res.send).toHaveBeenCalledWith('id,timestamp\n1,now');
  });
});

describe('MonitoringController', () => {
  let controller: MonitoringController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonitoringController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(MonitoringController);
  });

  afterEach(() => jest.clearAllMocks());

  it('getHealth fills in the measured API response time', async () => {
    mockAuditService.getHealthStatus.mockResolvedValue({
      api: { status: 'healthy', uptime: 100, responseTime: 0 },
      database: { status: 'connected', queryTime: 1, connections: 1 },
      redis: { status: 'connected', hitRate: 0, memoryUsed: 'unknown' },
      discord: { status: 'connected', guilds: 1, latency: 1 },
    });

    const health = await controller.getHealth();

    expect(mockAuditService.getHealthStatus).toHaveBeenCalled();
    expect(health.api.status).toBe('healthy');
    expect(typeof health.api.responseTime).toBe('number');
    expect(health.api.responseTime).toBeGreaterThanOrEqual(0);
  });

  it('getUsage delegates to the service', async () => {
    const expected = {
      totalRequests: 0,
      byProject: [],
      byEndpoint: [],
      errors: { total: 0, byType: { '4xx': 0, '5xx': 0 } },
    };
    mockAuditService.getUsageStats.mockResolvedValue(expected);
    const dto = { period: '30d' } as any;

    await expect(controller.getUsage(dto)).resolves.toBe(expected);
    expect(mockAuditService.getUsageStats).toHaveBeenCalledWith(dto);
  });
});
