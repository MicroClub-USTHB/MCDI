import { Test } from '@nestjs/testing';
import { DiscordModule } from './discord.module';
import { DiscordService } from './discord.service';

describe('DiscordModule', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('skips bot connection on module init in test environment', async () => {
    const mockDiscordService = {
      startBotConnection: jest.fn(),
      onBotReady: jest.fn(),
      getClient: jest.fn().mockReturnValue({ user: { tag: 'bot#1234' } }),
      destroyBotConnection: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordModule,
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();

    const module = moduleRef.get(DiscordModule);
    module.onModuleInit();

    expect(mockDiscordService.onBotReady).not.toHaveBeenCalled();
    expect(mockDiscordService.startBotConnection).not.toHaveBeenCalled();
  });

  it('starts bot connection on module init outside test environment', async () => {
    process.env.NODE_ENV = 'development';

    const mockDiscordService = {
      startBotConnection: jest.fn(),
      onBotReady: jest.fn(),
      getClient: jest.fn().mockReturnValue({ user: { tag: 'bot#1234' } }),
      destroyBotConnection: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordModule,
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();

    const module = moduleRef.get(DiscordModule);
    module.onModuleInit();

    expect(mockDiscordService.onBotReady).toHaveBeenCalledWith(
      expect.any(Function),
    );
    expect(mockDiscordService.startBotConnection).toHaveBeenCalledTimes(1);
  });

  it('destroys bot connection on module shutdown', async () => {
    const mockDiscordService = {
      startBotConnection: jest.fn(),
      onBotReady: jest.fn(),
      getClient: jest.fn().mockReturnValue({ user: { tag: 'bot#1234' } }),
      destroyBotConnection: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordModule,
        { provide: DiscordService, useValue: mockDiscordService },
      ],
    }).compile();

    const module = moduleRef.get(DiscordModule);
    await module.onModuleDestroy();

    expect(mockDiscordService.destroyBotConnection).toHaveBeenCalledTimes(1);
  });
});
