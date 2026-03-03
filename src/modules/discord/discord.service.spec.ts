import { Test, TestingModule } from '@nestjs/testing';
import { DiscordService } from './discord.service';
import { DISCORD_CLIENT } from './discord.constants';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeGuild(overrides: Record<string, unknown> = {}) {
  return {
    channels: {
      fetch: jest.fn().mockResolvedValue(new Map()),
      create: jest.fn(),
    },
    members: { fetch: jest.fn() },
    roles: { fetch: jest.fn() },
    ...overrides,
  };
}

function buildMockClient() {
  return {
    users: { fetch: jest.fn() },
    guilds: { fetch: jest.fn() },
    channels: { fetch: jest.fn() },
  };
}

// ── Suite ──────────────────────────────────────────────────────────────────

describe('DiscordService', () => {
  let service: DiscordService;
  let mockClient: ReturnType<typeof buildMockClient>;

  beforeEach(async () => {
    mockClient = buildMockClient();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        { provide: DISCORD_CLIENT, useValue: mockClient },
      ],
    }).compile();

    service = module.get(DiscordService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getClient ──────────────────────────────────────────────────────────

  it('returns the injected client', () => {
    expect(service.getClient()).toBe(mockClient);
  });

  // ── getUserById ────────────────────────────────────────────────────────

  describe('getUserById', () => {
    it('returns the user on success', async () => {
      const fakeUser = { id: 'u-1' };
      mockClient.users.fetch.mockResolvedValue(fakeUser);
      expect(await service.getUserById('u-1')).toBe(fakeUser);
    });

    it('returns null when fetch throws', async () => {
      mockClient.users.fetch.mockRejectedValue(new Error('Unknown User'));
      expect(await service.getUserById('bad')).toBeNull();
    });
  });

  // ── getGuildById ──────────────────────────────────────────────────────

  describe('getGuildById', () => {
    it('returns the guild on success', async () => {
      const guild = makeGuild();
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getGuildById('g-1')).toBe(guild);
    });

    it('returns null when fetch throws', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Unknown Guild'));
      expect(await service.getGuildById('bad')).toBeNull();
    });
  });

  // ── getGuildMember ────────────────────────────────────────────────────

  describe('getGuildMember', () => {
    it('returns member from guild', async () => {
      const fakeMember = { id: 'mem-1', roles: { cache: { has: () => true } } };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getGuildMember('g-1', 'mem-1')).toBe(fakeMember);
    });

    it('returns null when guild is not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getGuildMember('bad', 'mem-1')).toBeNull();
    });

    it('returns null when member fetch throws', async () => {
      const guild = makeGuild({
        members: { fetch: jest.fn().mockRejectedValue(new Error('No member')) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getGuildMember('g-1', 'missing')).toBeNull();
    });
  });

  // ── getAllGuildMembers ─────────────────────────────────────────────────

  describe('getAllGuildMembers', () => {
    it('returns members collection on success', async () => {
      const members = new Map([['u-1', { id: 'u-1' }]]);
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(members) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getAllGuildMembers('g-1')).toBe(members);
    });

    it('returns null when guild not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getAllGuildMembers('bad')).toBeNull();
    });
  });

  // ── getChannelById ────────────────────────────────────────────────────

  describe('getChannelById', () => {
    it('returns the channel on success', async () => {
      const chan = {
        id: 'ch-1',
        isDMBased: () => false,
        isTextBased: () => true,
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.getChannelById('ch-1')).toBe(chan);
    });

    it('returns null on error', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Unknown channel'));
      expect(await service.getChannelById('bad')).toBeNull();
    });
  });

  // ── getGuildChannels ──────────────────────────────────────────────────

  describe('getGuildChannels', () => {
    it('returns channels on success', async () => {
      const channels = new Map([['ch-1', {}]]);
      const guild = makeGuild({
        channels: { fetch: jest.fn().mockResolvedValue(channels) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getGuildChannels('g-1')).toBe(channels);
    });

    it('returns null when guild not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getGuildChannels('bad')).toBeNull();
    });
  });

  // ── createChannel ─────────────────────────────────────────────────────

  describe('createChannel', () => {
    it('returns the created channel on success', async () => {
      const fakeChan = { id: 'new-ch' };
      const guild = makeGuild({
        channels: { create: jest.fn().mockResolvedValue(fakeChan) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.createChannel('g-1', 'general')).toBe(fakeChan);
    });

    it('returns null when guild not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.createChannel('bad', 'general')).toBeNull();
    });
  });

  // ── deleteChannel ─────────────────────────────────────────────────────

  describe('deleteChannel', () => {
    it('returns false when channel not found (throws)', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.deleteChannel('bad')).toBe(false);
    });

    it('returns false when channel is DM-based', async () => {
      const dmChan = { isDMBased: () => true, delete: jest.fn() };
      mockClient.channels.fetch.mockResolvedValue(dmChan);
      expect(await service.deleteChannel('dm-1')).toBe(false);
    });

    it('returns true after deleting a valid channel', async () => {
      const chan = {
        isDMBased: () => false,
        delete: jest.fn().mockResolvedValue(undefined),
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.deleteChannel('ch-1')).toBe(true);
    });
  });

  // ── editChannel ───────────────────────────────────────────────────────

  describe('editChannel', () => {
    it('returns null when channel is DM-based', async () => {
      const dmChan = {
        isDMBased: () => true,
        isTextBased: () => false,
        edit: jest.fn(),
      };
      mockClient.channels.fetch.mockResolvedValue(dmChan);
      expect(await service.editChannel('dm-1', {})).toBeNull();
    });

    it('returns edited channel on success', async () => {
      const edited = { id: 'ch-1', name: 'new-name' };
      const chan = {
        isDMBased: () => false,
        edit: jest.fn().mockResolvedValue(edited),
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.editChannel('ch-1', { name: 'new-name' })).toBe(
        edited,
      );
    });

    it('returns null on error', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.editChannel('bad', {})).toBeNull();
    });
  });

  // ── getChannelMessages ────────────────────────────────────────────────

  describe('getChannelMessages', () => {
    it('returns null when channel is not text-based', async () => {
      const chan = { isDMBased: () => false, isTextBased: () => false };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.getChannelMessages('ch-1')).toBeNull();
    });

    it('returns messages on success', async () => {
      const msgs = new Map([['msg-1', {}]]);
      const chan = {
        isTextBased: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(msgs) },
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.getChannelMessages('ch-1')).toBe(msgs);
    });

    it('returns null on error', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getChannelMessages('bad')).toBeNull();
    });
  });

  // ── getMessageById ────────────────────────────────────────────────────

  describe('getMessageById', () => {
    it('returns null when channel is not text-based', async () => {
      const chan = { isTextBased: () => false };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.getMessageById('ch-1', 'msg-1')).toBeNull();
    });

    it('returns message on success', async () => {
      const msg = { id: 'msg-1' };
      const chan = {
        isTextBased: () => true,
        messages: { fetch: jest.fn().mockResolvedValue(msg) },
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.getMessageById('ch-1', 'msg-1')).toBe(msg);
    });

    it('returns null on error', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getMessageById('bad', 'msg-1')).toBeNull();
    });
  });

  // ── bulkDeleteMessages ────────────────────────────────────────────────

  describe('bulkDeleteMessages', () => {
    it('returns null when channel is DM-based', async () => {
      const chan = { isDMBased: () => true, isTextBased: () => true };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.bulkDeleteMessages('ch-1', 5)).toBeNull();
    });

    it('returns null when channel is not text-based', async () => {
      const chan = { isDMBased: () => false, isTextBased: () => false };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.bulkDeleteMessages('ch-1', 5)).toBeNull();
    });

    it('returns deleted messages on success', async () => {
      const deleted = new Map([['msg-1', {}]]);
      const chan = {
        isDMBased: () => false,
        isTextBased: () => true,
        bulkDelete: jest.fn().mockResolvedValue(deleted),
      };
      mockClient.channels.fetch.mockResolvedValue(chan);
      expect(await service.bulkDeleteMessages('ch-1', 5)).toBe(deleted);
    });

    it('returns null on error', async () => {
      mockClient.channels.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.bulkDeleteMessages('bad', 5)).toBeNull();
    });
  });

  // ── getRoleById ───────────────────────────────────────────────────────

  describe('getRoleById', () => {
    it('returns the role on success', async () => {
      const fakeRole = { id: 'role-1' };
      const guild = makeGuild({
        roles: { fetch: jest.fn().mockResolvedValue(fakeRole) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.getRoleById('g-1', 'role-1')).toBe(fakeRole);
    });

    it('returns null when guild not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.getRoleById('bad', 'role-1')).toBeNull();
    });
  });

  // ── addRoleToMember ───────────────────────────────────────────────────

  describe('addRoleToMember', () => {
    it('returns true after adding role', async () => {
      const fakeMember = {
        roles: {
          add: jest.fn().mockResolvedValue(undefined),
          cache: { has: () => false },
        },
      };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.addRoleToMember('g-1', 'u-1', 'role-1')).toBe(true);
    });

    it('returns false when member not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.addRoleToMember('g-1', 'u-1', 'role-1')).toBe(false);
    });

    it('returns false when roles.add throws', async () => {
      const fakeMember = {
        roles: {
          add: jest.fn().mockRejectedValue(new Error('perms')),
          cache: { has: () => false },
        },
      };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.addRoleToMember('g-1', 'u-1', 'role-1')).toBe(false);
    });
  });

  // ── removeRoleFromMember ──────────────────────────────────────────────

  describe('removeRoleFromMember', () => {
    it('returns true after removing role', async () => {
      const fakeMember = {
        roles: {
          remove: jest.fn().mockResolvedValue(undefined),
          cache: { has: () => true },
        },
      };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.removeRoleFromMember('g-1', 'u-1', 'role-1')).toBe(
        true,
      );
    });

    it('returns false when member not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.removeRoleFromMember('g-1', 'u-1', 'role-1')).toBe(
        false,
      );
    });
  });

  // ── memberHasRole ─────────────────────────────────────────────────────

  describe('memberHasRole', () => {
    it('returns true when member has the role', async () => {
      const fakeMember = {
        roles: { cache: { has: (id: string) => id === 'role-1' } },
      };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.memberHasRole('g-1', 'u-1', 'role-1')).toBe(true);
    });

    it('returns false when member does not have the role', async () => {
      const fakeMember = { roles: { cache: { has: () => false } } };
      const guild = makeGuild({
        members: { fetch: jest.fn().mockResolvedValue(fakeMember) },
      });
      mockClient.guilds.fetch.mockResolvedValue(guild);
      expect(await service.memberHasRole('g-1', 'u-1', 'role-99')).toBe(false);
    });

    it('returns false when member not found', async () => {
      mockClient.guilds.fetch.mockRejectedValue(new Error('Not found'));
      expect(await service.memberHasRole('bad', 'u-1', 'role-1')).toBe(false);
    });
  });
});
