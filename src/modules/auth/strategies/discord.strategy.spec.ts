import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Profile } from 'passport-discord';
import { DiscordStrategy } from './discord.strategy';

// passport-discord uses PassportStrategy which calls super() with config.
// We need to mock the base Strategy so the constructor doesn't throw.
jest.mock('passport-discord', () => {
  const Strategy = jest.fn().mockImplementation(() => ({
    name: 'discord',
  }));
  return { Strategy };
});

// PassportStrategy mixin calls new Strategy(...) via super — mock it to be a plain class.
jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (Base: any) => {
    return class MockPassportStrategy {
      constructor(...args: any[]) {
        // simulate what PassportStrategy does: call super with the config
        new Base(...args);
      }
    };
  },
}));

async function buildStrategy(configValues: Record<string, string> = {}) {
  const defaults = {
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'client-secret',
    DISCORD_CALLBACK_URL: 'https://mcdi.example.com/auth/discord/callback',
    ...configValues,
  };

  const configService = { get: jest.fn((key: string) => defaults[key]) };

  const mod = await Test.createTestingModule({
    providers: [
      DiscordStrategy,
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();

  return mod.get(DiscordStrategy);
}

describe('DiscordStrategy', () => {
  describe('constructor', () => {
    it('creates the strategy using config values', async () => {
      const strategy = await buildStrategy();
      expect(strategy).toBeDefined();
    });

    it('throws when required config values are missing', async () => {
      await expect(
        buildStrategy({
          DISCORD_CLIENT_SECRET: '',
        }),
      ).rejects.toThrow('Missing required Discord OAuth configuration');
    });
  });

  describe('validate', () => {
    it('returns user object from Discord profile', async () => {
      const strategy = await buildStrategy();

      const profile: Profile = {
        id: 'discord-123',
        username: 'alice',
        discriminator: '0001',
        avatar: 'avatar-hash',
        email: 'alice@example.com',
        provider: 'discord',
        global_name: 'Alice',
        locale: 'en-US',
        mfa_enabled: false,
        verified: true,
        flags: 0,
        banner: null,
        accent_color: null,
        public_flags: 0,
        avatar_decoration_data: null,
        premium_type: 0,
        fetchedAt: new Date().toISOString(),
        displayName: 'Alice',
      };

      const result = (await strategy.validate(
        'access-token',
        'refresh-token',
        profile,
      )) as any;

      expect(result).toEqual({
        discordId: 'discord-123',
        username: 'alice',
        discriminator: '0001',
        avatar: 'avatar-hash',
        email: 'alice@example.com',
        accessToken: 'access-token',
      });
    });

    it('email is undefined when profile has no email', async () => {
      const strategy = await buildStrategy();
      const profile: Profile = {
        id: 'discord-456',
        username: 'bob',
        discriminator: '0002',
        avatar: null,
        email: undefined,
        provider: 'discord',
        global_name: 'Bob',
        locale: 'en-US',
        mfa_enabled: false,
        verified: false,
        flags: 0,
        banner: null,
        accent_color: null,
        public_flags: 0,
        avatar_decoration_data: null,
        premium_type: 0,
        fetchedAt: new Date().toISOString(),
        displayName: 'Bob',
      };

      const result = (await strategy.validate('tok', '', profile)) as any;
      expect(result.discordId).toBe('discord-456');
      expect(result.email).toBeUndefined();
    });
  });
});
