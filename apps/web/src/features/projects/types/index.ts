/**
 * Scopes a project can hold on a server. Mirrors the backend's `ProjectScope`
 * enum; the OAuth `scope` param is built from these.
 */
export const PROJECT_SCOPES = ['read_members', 'check_permissions'] as const;
export type ProjectScope = (typeof PROJECT_SCOPES)[number];

/** Operations a project may perform on a granted server. */
export const PROJECT_OPERATIONS = ['READ', 'SEND_MESSAGES', 'MANAGE_WEBHOOKS'] as const;
export type ProjectOperation = (typeof PROJECT_OPERATIONS)[number];

export interface AccessOperations {
  READ: boolean;
  SEND_MESSAGES: boolean;
  MANAGE_WEBHOOKS: boolean;
}

/** Raw shape returned by `GET /api/admin/projects` and the other project CRUD endpoints. */
export interface ProjectDto {
  id: string;
  name: string;
  description: string | null;
  isInternal: boolean;
  webhookUrl: string | null;
  apiKeyPrefix: string | null;
  apiKeyCreatedAt: string;
  apiKeyLastUsedAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

import type { CreateInboundWebhookResponse } from '@/features/inbound-webhooks/types';

/** One `serverAccess` item in `POST /api/admin/projects`. Operations are NOT accepted here. */
export interface ProjectServerAccessDto {
  serverId: string;
  scopes?: ProjectScope[];
}

/** Payload for optional inbound webhook provisioned during project creation. */
export interface ProjectInboundWebhookPayload {
  name: string;
  slug?: string;
  schema: Record<string, unknown>;
  allowedRoleIds?: string[];
  acceptedOrigins?: string[];
}

/** Request body for `POST /api/admin/projects` (step 1 of creation). */
export interface CreateProjectPayload {
  name: string;
  description?: string;
  isInternal?: boolean;
  serverAccess?: ProjectServerAccessDto[];
  inboundWebhook?: ProjectInboundWebhookPayload;
}

/** Request body for `PATCH /api/admin/projects/:id`. */
export interface UpdateProjectPayload {
  name?: string;
  description?: string;
  isInternal?: boolean;
  isActive?: boolean;
  webhookUrl?: string | null;
}

/** Request body for `PUT /api/admin/projects/:projectId/servers/:serverId`. */
export interface SetServerAccessPayload {
  operations?: Partial<AccessOperations>;
  scopes?: ProjectScope[];
}

/** Response body of `POST /api/admin/projects` — the full key is returned ONCE. */
export interface CreateProjectResponse {
  apiKey: string;
  project: ProjectDto;
  inboundWebhook?: CreateInboundWebhookResponse;
}

/** Response body of `POST /api/admin/projects/:id/regenerate-api-key`. */
export interface RegenerateApiKeyResponse {
  projectId: string;
  apiKey: string;
  apiKeyPrefix: string;
  apiKeyCreatedAt: string;
}

/** Raw shape returned by `GET /api/admin/projects/:id/api-key` (prefix only). */
export interface ApiKeyInfoDto {
  projectId: string;
  projectName: string;
  apiKeyPrefix: string | null;
  apiKeyCreatedAt: string;
  apiKeyLastUsedAt: string | null;
  isActive: boolean;
}

export const ACCESS_AUDIT_ACTIONS = ['GRANT', 'UPDATE', 'REVOKE'] as const;
export type AccessAuditAction = (typeof ACCESS_AUDIT_ACTIONS)[number];

/** Raw row from `GET /api/admin/projects/access/audit`. */
export interface AccessAuditEntry {
  id: number;
  projectId: string;
  serverId: string;
  action: AccessAuditAction;
  operationsBefore: AccessOperations | null;
  operationsAfter: AccessOperations | null;
  changedBy: string;
  changedAt: string;
}

/** Raw row from `GET /api/admin/projects/access/matrix`. */
export interface AccessMatrixEntry {
  projectId: string;
  projectName: string;
  serverId: string;
  serverName: string;
  operations: AccessOperations;
  scopes: ProjectScope[];
  updatedAt: string;
}

export interface ProjectInboundWebhookFormValues {
  enabled: boolean;
  name: string;
  slug?: string;
  schema: Record<string, unknown>;
  origins?: string;
}

/** Form model used by the two-step creation wizard. */
export interface ProjectFormValues {
  name: string;
  description: string;
  isInternal: boolean;
  scopes: ProjectScope[];
  serverIds: string[];
  inboundWebhook?: ProjectInboundWebhookFormValues;
}
