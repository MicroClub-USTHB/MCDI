import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ProjectAdminController } from './project-admin.controller';
import { ProjectsService } from './projects.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';

const mockProjectsService = {
  regenerateApiKeyAdmin: jest.fn(),
  updateRedirectUri: jest.fn(),
};

describe('ProjectAdminController', () => {
  let controller: ProjectAdminController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectAdminController],
      providers: [
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    })
      .overrideGuard(SystemAdminGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ProjectAdminController);
  });

  afterEach(() => jest.clearAllMocks());

  it('regenerateApiKey delegates to service', async () => {
    mockProjectsService.regenerateApiKeyAdmin.mockResolvedValue({
      projectId: 'p1',
      apiKey: 'new-key',
    });
    const result = await controller.regenerateApiKey('p1');
    expect(mockProjectsService.regenerateApiKeyAdmin).toHaveBeenCalledWith('p1');
    expect(result).toMatchObject({ projectId: 'p1' });
  });

  it('regenerateApiKey propagates NotFoundException', async () => {
    mockProjectsService.regenerateApiKeyAdmin.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(controller.regenerateApiKey('bad-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('updateRedirectUri delegates to service', async () => {
    mockProjectsService.updateRedirectUri.mockResolvedValue({
      projectId: 'p1',
      redirectUri: 'https://events.microclub.net/auth/callback',
    });
    const result = await controller.updateRedirectUri('p1', {
      redirectUri: 'https://events.microclub.net/auth/callback',
    });
    expect(mockProjectsService.updateRedirectUri).toHaveBeenCalledWith(
      'p1',
      { redirectUri: 'https://events.microclub.net/auth/callback' },
    );
    expect(result).toMatchObject({ projectId: 'p1' });
  });

  it('updateRedirectUri propagates NotFoundException', async () => {
    mockProjectsService.updateRedirectUri.mockRejectedValue(
      new NotFoundException(),
    );
    await expect(
      controller.updateRedirectUri('bad-id', { redirectUri: 'https://x.com/cb' }),
    ).rejects.toThrow(NotFoundException);
  });
});
