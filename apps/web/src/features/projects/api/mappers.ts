import type {
  ApiKeyInfoDto,
  CreateProjectPayload,
  ProjectFormValues,
  ProjectDto,
} from '@/features/projects/types';

export interface ProjectView {
  id: string;
  name: string;
  description: string | null;
  isInternal: boolean;
  isActive: boolean;
  apiKeyPrefix: string | null;
  createdAtLabel: string;
  lastUsedLabel: string | null;
}

export interface ApiKeyView {
  projectId: string;
  projectName: string;
  prefix: string | null;
  createdAtLabel: string;
  lastUsedLabel: string | null;
  isActive: boolean;
}

/** Formats a `Date`-ish string; empty/undefined → `'Never'`. */
function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

/** List/detail row model: normalized booleans + display-ready dates. */
export function mapProjectResponse(dto: ProjectDto): ProjectView {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    isInternal: dto.isInternal,
    isActive: dto.isActive,
    apiKeyPrefix: dto.apiKeyPrefix,
    createdAtLabel: formatDate(dto.createdAt) ?? 'Never',
    lastUsedLabel: formatDate(dto.apiKeyLastUsedAt),
  };
}

/** `GET /:id/api-key` → display model. */
export function mapApiKeyResponse(dto: ApiKeyInfoDto): ApiKeyView {
  return {
    projectId: dto.projectId,
    projectName: dto.projectName,
    prefix: dto.apiKeyPrefix,
    createdAtLabel: formatDate(dto.apiKeyCreatedAt) ?? 'Never',
    lastUsedLabel: formatDate(dto.apiKeyLastUsedAt),
    isActive: dto.isActive,
  };
}

/**
 * Wizard form → `POST /admin/projects` body. The form's global scope selection
 * is attached to every granted server (`ProjectServerAccessDto.scopes` is
 * per-server on the wire); `serverAccess` is omitted entirely when no server is
 * selected, and empty description is dropped (the DTO treats absence as null).
 */
export function toCreateProjectDto(form: ProjectFormValues): CreateProjectPayload {
  return {
    name: form.name.trim(),
    ...(form.description.trim() !== '' ? { description: form.description.trim() } : {}),
    ...(form.isInternal ? { isInternal: true } : {}),
    ...(form.serverIds.length > 0
      ? {
          serverAccess: form.serverIds.map((serverId) => ({
            serverId,
            scopes: form.scopes,
          })),
        }
      : {}),
  };
}

/** Looks up a project's current URI list from the stored comma-separated string. */
export function splitRedirectUris(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((uri) => uri.trim())
    .filter((uri) => uri.length > 0);
}
