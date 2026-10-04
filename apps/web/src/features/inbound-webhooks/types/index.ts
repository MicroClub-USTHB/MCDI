/** A row of `GET /api/admin/inbound-webhooks`. The signing secret is never part of it. */
export interface InboundWebhookDto {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  schema: Record<string, unknown>;
  acceptedOrigins: string[];
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  allowRoleInheritance: boolean;
  isActive: boolean;
  submissionCount: number;
  lastSubmissionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A row of `GET /api/admin/inbound-webhooks/:id/roles`. */
export interface AllowedRoleDto {
  roleId: string;
  roleName: string;
  roleColor: number | null;
  serverId: string;
  grantedAt: string;
  grantedBy: string | null;
}

/** One problem the schema check found, located by its path in the schema. */
export interface SchemaProblemDto {
  path: string;
  code: string;
  message: string;
}

/** `POST /api/admin/inbound-webhooks/schema/preview` */
export type SchemaPreviewDto =
  | { ok: false; errors: SchemaProblemDto[] }
  | { ok: true; markdown: string; examplePayload: Record<string, unknown> };

export interface PreviewSchemaPayload {
  schema: Record<string, unknown>;
  name?: string;
  requireSignature?: boolean;
  rejectUnknownFields?: boolean;
  acceptedOrigins?: string[];
}

export interface CreateInboundWebhookPayload {
  projectId: string;
  name: string;
  slug: string;
  schema: Record<string, unknown>;
  allowedRoleIds: string[];
  acceptedOrigins: string[];
  requireSignature: boolean;
  rejectUnknownFields: boolean;
}

/** The signing secret appears here, once, and nowhere else. */
export interface CreateInboundWebhookResponse {
  webhook: InboundWebhookDto;
  signingSecret: string;
  allowedRoleIds: string[];
  submitUrl: string;
  docsUrl: string;
}

export interface DefaultReaderRoleDto {
  id: string;
  name: string;
  serverId: string;
  serverName: string;
}

/** `GET /api/admin/inbound-webhooks/settings` */
export interface InboundWebhookSettingsDto {
  defaultReaderRoleIds: string[];
  /** The ones that still exist; a deleted role stays in the ids only. */
  defaultReaderRoles: DefaultReaderRoleDto[];
  /** `environment` until the setting is first saved. */
  source: 'settings' | 'environment';
  updatedAt: string | null;
  updatedBy: string | null;
}

/** What `PATCH /api/admin/inbound-webhooks/:id` accepts; each property is optional. */
export interface UpdateInboundWebhookPayload {
  name?: string;
  schema?: Record<string, unknown>;
  acceptedOrigins?: string[];
  requireSignature?: boolean;
  rejectUnknownFields?: boolean;
  isActive?: boolean;
}

export interface SubmissionDto {
  id: string;
  payload: Record<string, unknown>;
  receivedAt: string;
  origin: string | null;
}

/** One submission opened in full: the list row plus where the request came from. */
export interface SubmissionDetailDto extends SubmissionDto {
  ipAddress: string | null;
  userAgent: string | null;
}

/** `GET /api/inbound-webhooks/:id/submissions` */
export interface SubmissionPageDto {
  submissions: SubmissionDto[];
  total: number;
  limit: number;
  offset: number;
}

export interface SubmissionFilters {
  /** `YYYY-MM-DD`, read as UTC. */
  dateFrom?: string;
  dateTo?: string;
  limit: number;
  offset: number;
}
