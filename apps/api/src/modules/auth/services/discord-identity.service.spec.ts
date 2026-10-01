import { Test, TestingModule } from '@nestjs/testing';
import { DiscordIdentityService } from './discord-identity.service';
import { DiscordService } from '../../discord/discord.service';
import { MemberRepository } from '../repositories/member.repository';

const mockDiscordService = {
  exchangeOAuthCode: jest.fn(),
  fetchOAuthProfile: jest.fn(),
};

const mockMemberRepository = {
  upsert: jest.fn(),
};

describe('DiscordIdentityService', () => {
  let service: DiscordIdentityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordIdentityService,
        { provide: DiscordService, useValue: mockDiscordService },
        { provide: MemberRepository, useValue: mockMemberRepository },
      ],
    }).compile();

    service = module.get(DiscordIdentityService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns null when code exchange fails', async () => {
    mockDiscordService.exchangeOAuthCode.mockResolvedValue(null);

    await expect(
      service.resolveIdentityFromOAuthCode('bad-code', 'http://localhost/cb'),
    ).resolves.toBeNull();
  });

  it('returns null when profile fetch fails', async () => {
    mockDiscordService.exchangeOAuthCode.mockResolvedValue('access-token');
    mockDiscordService.fetchOAuthProfile.mockResolvedValue(null);

    await expect(
      service.resolveIdentityFromOAuthCode('code', 'http://localhost/cb'),
    ).resolves.toBeNull();
  });

  it('upserts the member and returns identity data on success', async () => {
    const profile = {
      id: 'discord-1',
      username: 'alice',
      global_name: 'Alice Global',
      display_name: 'Alice Display',
      avatar: 'avatar-hash',
      email: 'alice@example.com',
    };
    const member = { id: 'discord-1', username: 'alice' };
    mockDiscordService.exchangeOAuthCode.mockResolvedValue('access-token');
    mockDiscordService.fetchOAuthProfile.mockResolvedValue(profile);
    mockMemberRepository.upsert.mockResolvedValue(member);

    const result = await service.resolveIdentityFromOAuthCode(
      'code',
      'http://localhost/cb',
    );

    expect(result).toEqual({
      accessToken: 'access-token',
      profile,
      member,
    });
    expect(mockMemberRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'discord-1',
        username: 'alice',
        globalName: 'Alice Global',
        displayName: 'Alice Display',
        avatar: 'avatar-hash',
        email: 'alice@example.com',
        syncedAt: expect.any(Date),
      }),
    );
  });

  it('falls back to global name when display name is missing', async () => {
    const profile = {
      id: 'discord-2',
      username: 'bob',
      global_name: 'Bob Global',
      display_name: null,
      avatar: null,
      email: null,
    };
    mockDiscordService.fetchOAuthProfile.mockResolvedValue(profile);
    mockMemberRepository.upsert.mockResolvedValue({ id: 'discord-2' });

    await service.resolveIdentityFromAccessToken('access-token');

    expect(mockMemberRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        displayName: 'Bob Global',
        email: undefined,
        avatar: undefined,
      }),
    );
  });
});
