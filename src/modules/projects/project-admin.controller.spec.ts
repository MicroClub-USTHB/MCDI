import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectAdminController } from './project-admin.controller';
import { ProjectAdminService } from './project-admin.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockProjectAdminService = { regenerateApiKey: jest.fn() };

describe('ProjectAdminController', () => {
  let controller: ProjectAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectAdminController],
      providers: [
        { provide: ProjectAdminService, useValue: mockProjectAdminService },
      ],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ProjectAdminController);
  });

  afterEach(() => jest.clearAllMocks());

  it('regenerateApiKey delegates to service', async () => {
    mockProjectAdminService.regenerateApiKey.mockResolvedValue({
      projectId: 'p1',
      apiKey: 'new-key',
    });
    const result = await controller.regenerateApiKey('p1');
    expect(mockProjectAdminService.regenerateApiKey).toHaveBeenCalledWith('p1');
    expect(result).toMatchObject({ projectId: 'p1' });
  });

  it('regenerateApiKey propagates NotFoundException', async () => {
    mockProjectAdminService.regenerateApiKey.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(controller.regenerateApiKey('bad-id')).rejects.toThrow(
      NotFoundException,
    );
  });
});
