import type { InboundWebhookDto } from '@/features/inbound-webhooks/types';

export interface InboundWebhookView {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  signatureLabel: 'Signed' | 'Unsigned';
  submissionCount: number;
  lastSubmissionLabel: string;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** Copies only display fields, so nothing sensitive reaches the list by accident. */
export function mapInboundWebhook(dto: InboundWebhookDto): InboundWebhookView {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    isActive: dto.isActive,
    signatureLabel: dto.requireSignature ? 'Signed' : 'Unsigned',
    submissionCount: dto.submissionCount,
    lastSubmissionLabel: formatDate(dto.lastSubmissionAt) ?? 'Never',
  };
}

/** The API's rule: lowercase letters, digits and dashes, 2 to 64 characters, no dash at either end. */
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
const SLUG_MAX = 64;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

/** A slug suggested from a name; the admin can still edit it. */
export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.slice(0, SLUG_MAX).replace(/-+$/g, '');
}

/** One origin per line or comma-separated; blanks dropped, each kept once. */
export function parseOrigins(text: string): string[] {
  const origins = text
    .split(/[\n,]/)
    .map((origin) => origin.trim())
    .filter(Boolean);
  return [...new Set(origins)];
}

export interface CreateFormValues {
  name: string;
  slug: string;
  schema: Record<string, unknown>;
  allowedRoleIds: string[];
  /** The raw origins field. */
  origins: string;
  requireSignature: boolean;
  rejectUnknownFields: boolean;
}

/**
 * Always sends the roles, never leaves them out: omitting them would make the
 * API apply the defaults, but the admin has already seen and edited the list.
 */
export function toCreatePayload(projectId: string, form: CreateFormValues) {
  return {
    projectId,
    name: form.name.trim(),
    slug: form.slug,
    schema: form.schema,
    allowedRoleIds: form.allowedRoleIds,
    acceptedOrigins: parseOrigins(form.origins),
    requireSignature: form.requireSignature,
    rejectUnknownFields: form.rejectUnknownFields,
  };
}

export interface RoleOption {
  id: string;
  name: string;
  serverName: string;
  isDefault: boolean;
}

interface ServerRoles {
  serverId: string;
  serverName: string;
  roles: { roleId: string; roleName: string }[];
}

interface DefaultRole {
  id: string;
  name: string;
  serverId: string;
  serverName: string;
}

/**
 * The roles an admin may pick: those of the given servers, plus the default
 * reader roles even from a server the project can't use (the API exempts
 * them). A default that is also on a listed server appears once, marked.
 */
export function buildRoleOptions(servers: ServerRoles[], defaults: DefaultRole[]): RoleOption[] {
  const defaultIds = new Set(defaults.map((role) => role.id));
  const options = new Map<string, RoleOption>();

  for (const server of servers) {
    for (const role of server.roles) {
      options.set(role.roleId, {
        id: role.roleId,
        name: role.roleName,
        serverName: server.serverName,
        isDefault: defaultIds.has(role.roleId),
      });
    }
  }
  for (const role of defaults) {
    if (!options.has(role.id)) {
      options.set(role.id, {
        id: role.id,
        name: role.name,
        serverName: role.serverName,
        isDefault: true,
      });
    }
  }
  return [...options.values()];
}
