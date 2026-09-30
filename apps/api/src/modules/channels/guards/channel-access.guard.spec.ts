import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ChannelAccessGuard } from './channel-access.guard';
import { DiscordService } from '../../discord/discord.service';

function makeRequest(overrides: Record<string, any> = {}) {
  return {
    params: {},
    ...overrides,
  };
}

function makeContext(request: any): any {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  };
}

describe('ChannelAccessGuard', () => {
  let guard: ChannelAccessGuard;
  let mockDiscordService: jest.Mocked<DiscordService>;

  const setupGuard = async (channelResult: any) => {
    mockDiscordService = {
      getChannelById: jest.fn().mockResolvedValue(channelResult),
    } as any;

    const module = await Test.createTestingModule({
      providers: [
        ChannelAccessGuard,
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();

    return module.get(ChannelAccessGuard);
  };

  it('should return true when channel exists and belongs to server', async () => {
    guard = await setupGuard({
      id: 'ch-1',
      guildId: 'server-123',
      isDMBased: () => false,
    });

    const result = await guard.canActivate(
      makeContext(
        makeRequest({
          params: { serverId: 'server-123', channelId: 'ch-1' },
        }),
      ),
    );

    expect(result).toBe(true);
  });

  it('should throw NotFoundException when channel is not found', async () => {
    guard = await setupGuard(null);

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({
            params: { serverId: 'server-123', channelId: 'invalid' },
          }),
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException for DM channels', async () => {
    guard = await setupGuard({
      id: 'dm-1',
      guildId: 'server-123',
      isDMBased: () => true,
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({
            params: { serverId: 'server-123', channelId: 'dm-1' },
          }),
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should throw NotFoundException when channel belongs to different server', async () => {
    guard = await setupGuard({
      id: 'ch-1',
      guildId: 'other-server',
      isDMBased: () => false,
    });

    await expect(
      guard.canActivate(
        makeContext(
          makeRequest({
            params: { serverId: 'server-123', channelId: 'ch-1' },
          }),
        ),
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should return true when no channelId is in params', async () => {
    mockDiscordService = {} as any;
    const module = await Test.createTestingModule({
      providers: [
        ChannelAccessGuard,
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();
    guard = module.get(ChannelAccessGuard);

    const result = await guard.canActivate(
      makeContext(
        makeRequest({
          params: { serverId: 'server-123' },
        }),
      ),
    );

    expect(result).toBe(true);
  });
});
