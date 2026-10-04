import { BadRequestException } from '@nestjs/common';
import { InboundWebhooksService } from './inbound-webhooks.service';
import type { CreateInboundWebhookDto } from './dto/create-inbound-webhook.dto';

const KEY = 'ab'.repeat(32);
const EXECUTIVE = '700000000000000001';
const LEADS = '700000000000000002';
const MEMBER = '700000000000000003';
const MAIN_SERVER = 'srv-main';
const PROJECT_SERVER = 'srv-events';

const roleRows: Record<string, { serverId: string; name: string }> = {
  [EXECUTIVE]: { serverId: MAIN_SERVER, name: 'MC Executive' },
  [LEADS]: { serverId: MAIN_SERVER, name: 'Dev Leads' },
  [MEMBER]: { serverId: PROJECT_SERVER, name: 'Member' },
};

const SCHEMA = {
  version: 1,
  steps: [
    { key: 'step', fields: [{ key: 'a', type: 'string', required: false }] },
  ],
};

const dto = (
  over: Partial<CreateInboundWebhookDto> = {},
): CreateInboundWebhookDto =>
  ({
    projectId: 'proj-1',
    name: 'Recruitment',
    slug: 'recruitment',
    schema: SCHEMA,
    ...over,
  }) as CreateInboundWebhookDto;

describe('InboundWebhooksService default reader roles', () => {
  let repository: Record<string, jest.Mock>;
  let audit: { insert: jest.Mock };
  let storedDefaults: string[] | null;
  let service: InboundWebhooksService;

  const build = (executiveRoleId: string | null = EXECUTIVE) => {
    storedDefaults = null;
    repository = {
      findBySlug: jest.fn().mockResolvedValue(null),
      findExistingRoles: jest.fn((ids: string[]) =>
        Promise.resolve(
          ids
            .filter((id) => roleRows[id])
            .map((id) => ({
              id,
              ...roleRows[id],
              serverName: roleRows[id].serverId,
              managed: false,
            })),
        ),
      ),
      findProjectServerIds: jest.fn().mockResolvedValue([PROJECT_SERVER]),
      getSettings: jest.fn(() =>
        Promise.resolve(
          storedDefaults === null
            ? null
            : {
                id: 1,
                defaultReaderRoleIds: storedDefaults,
                updatedAt: new Date('2026-10-04T10:00:00Z'),
                updatedBy: 'admin-1',
              },
        ),
      ),
      upsertSettings: jest.fn((ids: string[]) => {
        storedDefaults = ids;
        return Promise.resolve();
      }),
      create: jest.fn((data: { name: string }) =>
        Promise.resolve({ id: 'wh-1', ...data }),
      ),
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'wh-1', projectId: 'proj-1' }),
      findAllowedRoleIds: jest.fn().mockResolvedValue([MEMBER]),
      replaceAllowedRoles: jest.fn().mockResolvedValue(undefined),
    };
    audit = { insert: jest.fn().mockResolvedValue(undefined) };
    service = new InboundWebhooksService(
      repository as never,
      audit as never,
      { delete: jest.fn().mockResolvedValue(1) } as never,
      {
        get: (name: string, fallback?: unknown) => {
          if (name === 'app.inboundWebhookEncryptionKey') return KEY;
          if (name === 'discord.executiveRoleId') {
            return executiveRoleId ?? undefined;
          }
          return fallback;
        },
      } as never,
    );
  };

  const createdRoleIds = () =>
    (repository.create.mock.calls[0][0] as { allowedRoleIds: string[] })
      .allowedRoleIds;

  beforeEach(() => build());

  describe('the setting', () => {
    it('falls back to the executive role while nothing is stored', async () => {
      const settings = await service.getSettings();

      expect(settings.defaultReaderRoleIds).toEqual([EXECUTIVE]);
      expect(settings.source).toBe('environment');
      expect(settings.defaultReaderRoles).toEqual([
        expect.objectContaining({ id: EXECUTIVE, name: 'MC Executive' }),
      ]);
    });

    it('has no defaults when nothing is stored and no executive role is configured', async () => {
      build(null);

      await expect(service.getSettings()).resolves.toMatchObject({
        defaultReaderRoleIds: [],
        source: 'environment',
      });
    });

    it('stores a new list, returns it as configured, and audits the change', async () => {
      const settings = await service.updateSettings(
        [LEADS, EXECUTIVE],
        'admin-1',
      );

      expect(repository.upsertSettings).toHaveBeenCalledWith(
        [LEADS, EXECUTIVE],
        'admin-1',
      );
      expect(settings.defaultReaderRoleIds).toEqual([LEADS, EXECUTIVE]);
      expect(settings.source).toBe('settings');
      expect(audit.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'settings.updated',
          entityType: 'inbound_webhook_settings',
          actorId: 'admin-1',
          details: { from: [EXECUTIVE], to: [LEADS, EXECUTIVE] },
        }),
      );
    });

    it('accepts an empty list as a deliberate "no defaults"', async () => {
      await service.updateSettings([], 'admin-1');

      await expect(service.getSettings()).resolves.toMatchObject({
        defaultReaderRoleIds: [],
        source: 'settings',
      });
    });

    it('stores each role once', async () => {
      await service.updateSettings([LEADS, LEADS], 'admin-1');

      expect(repository.upsertSettings).toHaveBeenCalledWith(
        [LEADS],
        'admin-1',
      );
    });

    it('rejects a role that does not exist, naming it', async () => {
      await expect(
        service.updateSettings([LEADS, '799999999999999999'], 'admin-1'),
      ).rejects.toThrow('799999999999999999');
      expect(repository.upsertSettings).not.toHaveBeenCalled();
    });

    it('reports only the roles that still exist when a stored default was deleted', async () => {
      storedDefaults = [LEADS, '799999999999999999'];

      const settings = await service.getSettings();

      expect(settings.defaultReaderRoleIds).toEqual([
        LEADS,
        '799999999999999999',
      ]);
      expect(settings.defaultReaderRoles.map((r) => r.id)).toEqual([LEADS]);
    });
  });

  describe('creating a webhook', () => {
    it('gets the default readers when it names none', async () => {
      await service.create(dto(), 'admin-1');

      expect(createdRoleIds()).toEqual([EXECUTIVE]);
    });

    it('uses the configured defaults once they are stored', async () => {
      storedDefaults = [LEADS];

      await service.create(dto(), 'admin-1');

      expect(createdRoleIds()).toEqual([LEADS]);
    });

    it('uses exactly the roles it names, so a default can be left out', async () => {
      await service.create(dto({ allowedRoleIds: [MEMBER] }), 'admin-1');

      expect(createdRoleIds()).toEqual([MEMBER]);
    });

    it('lets a default role be named even though its server is not the project’s', async () => {
      await expect(
        service.create(dto({ allowedRoleIds: [EXECUTIVE, MEMBER] }), 'admin-1'),
      ).resolves.toBeDefined();

      expect(createdRoleIds()).toEqual([EXECUTIVE, MEMBER]);
    });

    it('still rejects any other role from a server the project cannot access', async () => {
      await expect(
        service.create(dto({ allowedRoleIds: [LEADS] }), 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('skips a default role that no longer exists', async () => {
      storedDefaults = ['799999999999999999', LEADS];

      await service.create(dto(), 'admin-1');

      expect(createdRoleIds()).toEqual([LEADS]);
    });

    it('is a 400 when there are no defaults and no roles are named', async () => {
      build(null);

      await expect(service.create(dto(), 'admin-1')).rejects.toThrow(
        /at least one reader role/i,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('is a 400 when every default role is gone', async () => {
      storedDefaults = ['799999999999999999'];

      await expect(service.create(dto(), 'admin-1')).rejects.toThrow(
        /at least one reader role/i,
      );
    });

    it('treats an explicit empty list as an error, not as "use the defaults"', async () => {
      await expect(
        service.create(dto({ allowedRoleIds: [] }), 'admin-1'),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('returns the roles the webhook ended up with', async () => {
      const result = await service.create(dto(), 'admin-1');

      expect(result.allowedRoleIds).toEqual([EXECUTIVE]);
    });
  });

  describe('replacing the readers of an existing webhook', () => {
    it('lets a default role be granted regardless of the project’s servers', async () => {
      await service.replaceAllowedRoles('wh-1', [EXECUTIVE], 'admin-1');

      expect(repository.replaceAllowedRoles).toHaveBeenCalledWith(
        'wh-1',
        [EXECUTIVE],
        'admin-1',
      );
    });

    it('can drop the default entirely', async () => {
      await service.replaceAllowedRoles('wh-1', [MEMBER], 'admin-1');

      expect(repository.replaceAllowedRoles).toHaveBeenCalledWith(
        'wh-1',
        [MEMBER],
        'admin-1',
      );
    });

    it('still rejects another role from a foreign server', async () => {
      await expect(
        service.replaceAllowedRoles('wh-1', [LEADS], 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
