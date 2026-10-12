import { describe, it, expect } from 'vitest';
import {
  mapApiKeyResponse,
  mapProjectResponse,
  splitRedirectUris,
  toCreateProjectDto,
} from '@/features/projects/api/mappers';
import type { ApiKeyInfoDto, ProjectDto } from '@/features/projects/types';

describe('mapProjectResponse', () => {
  it('normalizes booleans and formats dates for the list/detail rows', () => {
    const dto: ProjectDto = {
      id: 'proj_1',
      name: 'Website',
      description: 'The MicroClub website',
      isInternal: true,
      webhookUrl: null,
      apiKeyPrefix: 'mcdi_abc123',
      apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
      apiKeyLastUsedAt: '2026-08-15T09:30:00.000Z',
      isActive: true,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    };

    const view = mapProjectResponse(dto);

    expect(view.id).toBe('proj_1');
    expect(view.name).toBe('Website');
    expect(view.isInternal).toBe(true);
    expect(view.isActive).toBe(true);
    expect(view.apiKeyPrefix).toBe('mcdi_abc123');
    expect(view.lastUsedLabel).not.toBeNull();
    expect(view.createdAtLabel).not.toBe('Never');
  });

  it('maps missing API-key usage to a null last-used label', () => {
    const dto: ProjectDto = {
      id: 'proj_2',
      name: 'Bot',
      description: null,
      isInternal: false,
      webhookUrl: null,
      apiKeyPrefix: null,
      apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
      apiKeyLastUsedAt: null,
      isActive: false,
      createdAt: '2026-08-01T10:00:00.000Z',
      updatedAt: '2026-08-01T10:00:00.000Z',
    };

    expect(mapProjectResponse(dto).lastUsedLabel).toBeNull();
    expect(mapProjectResponse(dto).isActive).toBe(false);
  });

  it('falls back to "Never" when the created date cannot be parsed', () => {
    const dto: ProjectDto = {
      id: 'proj_3',
      name: 'Broken',
      description: null,
      isInternal: false,
      webhookUrl: null,
      apiKeyPrefix: null,
      apiKeyCreatedAt: 'not-a-date',
      apiKeyLastUsedAt: null,
      isActive: true,
      createdAt: 'not-a-date',
      updatedAt: 'not-a-date',
    };

    expect(mapProjectResponse(dto).createdAtLabel).toBe('Never');
  });
});

describe('mapApiKeyResponse', () => {
  it('exposes only the prefix and display-ready dates', () => {
    const dto: ApiKeyInfoDto = {
      projectId: 'proj_1',
      projectName: 'Website',
      apiKeyPrefix: 'mcdi_abc123',
      apiKeyCreatedAt: '2026-08-01T10:00:00.000Z',
      apiKeyLastUsedAt: null,
      isActive: true,
    };

    const view = mapApiKeyResponse(dto);

    expect(view.prefix).toBe('mcdi_abc123');
    expect(view.lastUsedLabel).toBeNull();
    expect(view.isActive).toBe(true);
    expect(view.projectName).toBe('Website');
  });
});

describe('toCreateProjectDto', () => {
  it('attaches the selected scopes to every granted server', () => {
    const dto = toCreateProjectDto({
      name: '  Website  ',
      description: '  ',
      isInternal: true,
      scopes: ['read_members', 'check_permissions'],
      serverIds: ['srv_1', 'srv_2'],
    });

    expect(dto.name).toBe('Website');
    expect(dto.description).toBeUndefined();
    expect(dto.isInternal).toBe(true);
    expect(dto.serverAccess).toEqual([
      { serverId: 'srv_1', scopes: ['read_members', 'check_permissions'] },
      { serverId: 'srv_2', scopes: ['read_members', 'check_permissions'] },
    ]);
  });

  it('omits serverAccess entirely when no server is selected', () => {
    const dto = toCreateProjectDto({
      name: 'Website',
      description: '',
      isInternal: false,
      scopes: ['read_members'],
      serverIds: [],
    });

    expect(dto.serverAccess).toBeUndefined();
    expect(dto.isInternal).toBeUndefined();
  });

  it('maps inboundWebhook when enabled with valid name and schema', () => {
    const schema = { version: 1, fields: [] };
    const dto = toCreateProjectDto({
      name: 'Website',
      description: '',
      isInternal: false,
      scopes: ['read_members'],
      serverIds: [],
      inboundWebhook: {
        enabled: true,
        name: '  Contact Form  ',
        slug: 'contact-form',
        schema,
        origins: 'https://microclub.dz\nhttps://sub.microclub.dz',
      },
    });

    expect(dto.inboundWebhook).toEqual({
      name: 'Contact Form',
      slug: 'contact-form',
      schema,
      acceptedOrigins: ['https://microclub.dz', 'https://sub.microclub.dz'],
    });
  });

  it('omits inboundWebhook when disabled or when name is whitespace', () => {
    const schema = { version: 1, fields: [] };
    const disabledDto = toCreateProjectDto({
      name: 'Website',
      description: '',
      isInternal: false,
      scopes: ['read_members'],
      serverIds: [],
      inboundWebhook: {
        enabled: false,
        name: 'Contact Form',
        slug: 'contact-form',
        schema,
      },
    });
    expect(disabledDto.inboundWebhook).toBeUndefined();

    const emptyNameDto = toCreateProjectDto({
      name: 'Website',
      description: '',
      isInternal: false,
      scopes: ['read_members'],
      serverIds: [],
      inboundWebhook: {
        enabled: true,
        name: '   ',
        schema,
      },
    });
    expect(emptyNameDto.inboundWebhook).toBeUndefined();
  });
});

describe('splitRedirectUris', () => {
  it('splits and trims a comma-separated list', () => {
    expect(splitRedirectUris('https://a.example/cb, https://b.example/oauth/cb ,')).toEqual([
      'https://a.example/cb',
      'https://b.example/oauth/cb',
    ]);
  });

  it('returns an empty array for null or blank input', () => {
    expect(splitRedirectUris(null)).toEqual([]);
    expect(splitRedirectUris('')).toEqual([]);
    expect(splitRedirectUris('  ,  ')).toEqual([]);
  });
});
