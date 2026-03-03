import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockProjectsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  regenerateKey: jest.fn(),
  revokeKey: jest.fn(),
  restoreKey: jest.fn(),
  delete: jest.fn(),
};

describe('ProjectsController', () => {
  let controller: ProjectsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [{ provide: ProjectsService, useValue: mockProjectsService }],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ProjectsController);
  });

  afterEach(() => jest.clearAllMocks());

  it('create delegates to projectsService', async () => {
    mockProjectsService.create.mockResolvedValue({
      apiKey: 'pk.secret',
      project: { id: 'p1' },
    });
    const dto = { name: 'Test Project' } as any;
    const result = await controller.create(dto);
    expect(mockProjectsService.create).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({ project: { id: 'p1' } });
  });

  it('findAll returns list from service', async () => {
    mockProjectsService.findAll.mockResolvedValue([]);
    const result = await controller.findAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it('findOne returns project', async () => {
    mockProjectsService.findOne.mockResolvedValue({ id: 'p1' });
    const result = await controller.findOne('p1');
    expect(result).toMatchObject({ id: 'p1' });
  });

  it('findOne propagates NotFoundException', async () => {
    mockProjectsService.findOne.mockRejectedValue(new NotFoundException());
    await expect(controller.findOne('bad')).rejects.toThrow(NotFoundException);
  });

  it('update delegates to service', async () => {
    mockProjectsService.update.mockResolvedValue({ id: 'p1', name: 'Updated' });
    await controller.update('p1', { name: 'Updated' } as any);
    expect(mockProjectsService.update).toHaveBeenCalledWith('p1', {
      name: 'Updated',
    });
  });

  it('regenerateKey delegates to service', async () => {
    mockProjectsService.regenerateKey.mockResolvedValue({ apiKey: 'new-key' });
    await controller.regenerateKey('p1');
    expect(mockProjectsService.regenerateKey).toHaveBeenCalledWith('p1');
  });

  it('revokeKey delegates to service', async () => {
    mockProjectsService.revokeKey.mockResolvedValue(undefined);
    await controller.revokeKey('p1');
    expect(mockProjectsService.revokeKey).toHaveBeenCalledWith('p1');
  });

  it('restoreKey delegates to service', async () => {
    mockProjectsService.restoreKey.mockResolvedValue(undefined);
    await controller.restoreKey('p1');
    expect(mockProjectsService.restoreKey).toHaveBeenCalledWith('p1');
  });

  it('delete delegates to service', async () => {
    mockProjectsService.delete.mockResolvedValue(undefined);
    await controller.delete('p1');
    expect(mockProjectsService.delete).toHaveBeenCalledWith('p1');
  });
});
