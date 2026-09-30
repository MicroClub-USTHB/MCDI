import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ServersController } from './servers.controller';
import { ServersService } from './servers.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockServersService = {
  registerServer: jest.fn(),
  listServers: jest.fn(),
  getServerById: jest.fn(),
  updateServer: jest.fn(),
  deleteServer: jest.fn(),
  disableServer: jest.fn(),
  enableServer: jest.fn(),
};

describe('ServersController', () => {
  let controller: ServersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ServersController],
      providers: [{ provide: ServersService, useValue: mockServersService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(ServersController);
  });

  afterEach(() => jest.clearAllMocks());

  it('register() delegates to serversService.registerServer', async () => {
    const dto = { guildId: 'g1', name: 'Main' } as any;
    mockServersService.registerServer.mockResolvedValue({ id: 'g1' });
    const result = await controller.register(dto);
    expect(mockServersService.registerServer).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'g1' });
  });

  it('list() delegates to serversService.listServers', async () => {
    mockServersService.listServers.mockResolvedValue([]);
    await controller.list({} as any);
    expect(mockServersService.listServers).toHaveBeenCalled();
  });

  it('findOne() returns server by id', async () => {
    mockServersService.getServerById.mockResolvedValue({ id: 's1' });
    const result = await controller.findOne('s1');
    expect(result).toEqual({ id: 's1' });
  });

  it('findOne() propagates NotFoundException from service', async () => {
    mockServersService.getServerById.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('bad')).rejects.toThrow(NotFoundException);
  });

  it('update() delegates to serversService.updateServer', async () => {
    const dto = { name: 'Updated' } as any;
    mockServersService.updateServer.mockResolvedValue({
      id: 's1',
      name: 'Updated',
    });
    await controller.update('s1', dto);
    expect(mockServersService.updateServer).toHaveBeenCalledWith('s1', dto);
  });

  it('remove() delegates to serversService.deleteServer', async () => {
    mockServersService.deleteServer.mockResolvedValue({ deleted: true });
    await controller.remove('s1');
    expect(mockServersService.deleteServer).toHaveBeenCalledWith('s1');
  });

  it('disable() delegates to serversService.disableServer', async () => {
    const dto = { reason: 'maintenance' } as any;
    mockServersService.disableServer.mockResolvedValue({
      id: 's1',
      isActive: false,
    });
    await controller.disable('s1', dto);
    expect(mockServersService.disableServer).toHaveBeenCalledWith('s1', dto);
  });

  it('enable() delegates to serversService.enableServer', async () => {
    mockServersService.enableServer.mockResolvedValue({
      id: 's1',
      isActive: true,
    });
    await controller.enable('s1');
    expect(mockServersService.enableServer).toHaveBeenCalledWith('s1');
  });
});
