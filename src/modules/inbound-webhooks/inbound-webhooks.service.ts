import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditRepository } from '../audit/audit.repository';
import { RedisService } from '../../common/redis/redis.service';
import { encryptSecret, decryptSecret } from '../../common/utils/crypto.util';
import {
  generateSigningSecret,
  verifySignature,
} from '../../common/utils/inbound-webhook-signature.util';
import {
  InboundWebhookRow,
  InboundWebhooksRepository,
  ListSubmissionsFilters,
} from './inbound-webhooks.repository';
import { validateSchema } from './schema/schema.validator';
import { validatePayload, FileMeta } from './schema/payload.validator';
import type { FormSchema } from './schema/form-schema.types';
import { CreateInboundWebhookDto } from './dto/create-inbound-webhook.dto';
import {
  renderMarkdown,
  renderOpenApi,
  WebhookDocsInput,
} from './docs/webhook-docs.generator';
import { UpdateInboundWebhookDto } from './dto/update-inbound-webhook.dto';

export interface CreateInboundWebhookResult {
  webhook: InboundWebhookRow;
  /** Returned ONCE — never stored in plaintext, never returned again */
  signingSecret: string;
  allowedRoleIds: string[];
  /** Where to send this webhook's submissions. */
  submitUrl: string;
  /** Developer documentation generated from the schema just declared. */
  docsUrl: string;
}

export type DocsFormat = 'markdown' | 'openapi';

export interface IngestContext {
  projectId: string;
  rawBody: Buffer | undefined;
  signatureHeader?: string;
  origin?: string;
  ipAddress?: string;
  userAgent?: string;
}

const REPLAY_PREFIX = 'iwh:sig:';
const RATE_PREFIX = 'iwh:rate:';

@Injectable()
export class InboundWebhooksService {
  private readonly logger = new Logger(InboundWebhooksService.name);

  constructor(
    private readonly repository: InboundWebhooksRepository,
    private readonly auditRepository: AuditRepository,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  // ─── Management ─────────────────────────────────────────────────────────

  async create(
    dto: CreateInboundWebhookDto,
    actor: string | null,
  ): Promise<CreateInboundWebhookResult> {
    const formSchema = this.assertValidSchema(dto.schema);

    const existing = await this.repository.findBySlug(dto.projectId, dto.slug);
    if (existing) {
      throw new ConflictException(
        `Project already has a webhook with slug "${dto.slug}"`,
      );
    }

    await this.assertRolesGrantable(dto.projectId, dto.allowedRoleIds);

    const signingSecret = generateSigningSecret();

    const webhook = await this.repository.create({
      projectId: dto.projectId,
      name: dto.name,
      slug: dto.slug,
      schema: formSchema,
      acceptedOrigins: dto.acceptedOrigins ?? [],
      signingSecretEnc: encryptSecret(signingSecret),
      requireSignature: dto.requireSignature ?? true,
      rejectUnknownFields: dto.rejectUnknownFields ?? true,
      allowRoleInheritance: dto.allowRoleInheritance ?? false,
      createdBy: actor,
      allowedRoleIds: dto.allowedRoleIds,
    });

    await this.audit({
      action: 'webhook.created',
      entityId: webhook.id,
      actorId: actor,
      details: {
        projectId: dto.projectId,
        slug: dto.slug,
        allowedRoleIds: dto.allowedRoleIds,
      },
    });

    const baseUrl = this.baseUrl();
    return {
      webhook,
      signingSecret,
      allowedRoleIds: dto.allowedRoleIds,
      submitUrl: `${baseUrl}/inbound-webhooks/${webhook.id}/submit`,
      docsUrl: `${baseUrl}/admin/inbound-webhooks/${webhook.id}/docs`,
    };
  }

  async findById(id: string): Promise<InboundWebhookRow> {
    const webhook = await this.repository.findById(id);
    if (!webhook) throw new NotFoundException('Inbound webhook not found');
    return webhook;
  }

  async listAll(projectId?: string): Promise<InboundWebhookRow[]> {
    return projectId
      ? this.repository.listByProject(projectId)
      : this.repository.listAll();
  }

  async update(
    id: string,
    dto: UpdateInboundWebhookDto,
    actor: string | null,
  ): Promise<InboundWebhookRow> {
    await this.findById(id);

    const patch: Parameters<InboundWebhooksRepository['update']>[1] = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.schema !== undefined)
      patch.schema = this.assertValidSchema(dto.schema);
    if (dto.acceptedOrigins !== undefined)
      patch.acceptedOrigins = dto.acceptedOrigins;
    if (dto.requireSignature !== undefined)
      patch.requireSignature = dto.requireSignature;
    if (dto.rejectUnknownFields !== undefined) {
      patch.rejectUnknownFields = dto.rejectUnknownFields;
    }
    if (dto.allowRoleInheritance !== undefined) {
      patch.allowRoleInheritance = dto.allowRoleInheritance;
    }
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const updated = await this.repository.update(id, patch);
    if (!updated) throw new NotFoundException('Inbound webhook not found');

    await this.audit({
      action: 'webhook.updated',
      entityId: id,
      actorId: actor,
      details: { fields: Object.keys(patch) },
    });
    return updated;
  }

  async getAllowedRoles(id: string) {
    await this.findById(id);
    return this.repository.findAllowedRoles(id);
  }

  async replaceAllowedRoles(
    id: string,
    roleIds: string[],
    actor: string | null,
  ): Promise<string[]> {
    const webhook = await this.findById(id);

    // Defence in depth: the DTO already enforces @ArrayNotEmpty, but an empty
    // set here would silently orphan every submission behind the webhook.
    if (roleIds.length === 0) {
      throw new BadRequestException(
        'At least one allowed role is required. Delete the webhook instead of removing its last role.',
      );
    }

    await this.assertRolesGrantable(webhook.projectId, roleIds);

    const previous = await this.repository.findAllowedRoleIds(id);
    await this.repository.replaceAllowedRoles(id, roleIds, actor);
    await this.invalidateRoleCache(id);

    await this.audit({
      action: 'roles.granted',
      entityId: id,
      actorId: actor,
      details: {
        granted: roleIds.filter((r) => !previous.includes(r)),
        revoked: previous.filter((r) => !roleIds.includes(r)),
      },
    });

    return roleIds;
  }

  async rotateSecret(id: string, actor: string | null): Promise<string> {
    await this.findById(id);
    const signingSecret = generateSigningSecret();
    await this.repository.updateSecret(id, encryptSecret(signingSecret));
    await this.audit({
      action: 'secret.rotated',
      entityId: id,
      actorId: actor,
    });
    return signingSecret;
  }

  async delete(id: string, actor: string | null): Promise<void> {
    const deleted = await this.repository.delete(id);
    if (!deleted) throw new NotFoundException('Inbound webhook not found');
    await this.invalidateRoleCache(id);
    await this.audit({
      action: 'webhook.deleted',
      entityId: id,
      actorId: actor,
    });
  }

  // ─── Developer documentation ────────────────────────────────────────────

  /**
   * Renders documentation for one webhook from its own live schema.
   *
   * Documentation generated from the schema cannot drift from validation,
   * because both read the same artefact: if a field is required, the table
   * says so because the validator would reject the payload without it.
   */
  async generateDocs(
    id: string,
    format: DocsFormat,
  ): Promise<{ filename: string; contentType: string; body: string }> {
    const webhook = await this.findById(id);
    const roles = await this.repository.findAllowedRoles(id);

    const baseUrl = this.baseUrl();

    const input: WebhookDocsInput = {
      id: webhook.id,
      name: webhook.name,
      slug: webhook.slug,
      schema: webhook.schema,
      acceptedOrigins: webhook.acceptedOrigins,
      requireSignature: webhook.requireSignature,
      rejectUnknownFields: webhook.rejectUnknownFields,
      isActive: webhook.isActive,
      createdAt: webhook.createdAt,
      allowedRoles: roles.map((r) => ({
        roleId: r.roleId,
        roleName: r.roleName,
      })),
      baseUrl,
    };

    if (format === 'openapi') {
      return {
        filename: `${webhook.slug}.openapi.json`,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify(renderOpenApi(input), null, 2),
      };
    }

    return {
      filename: `${webhook.slug}.md`,
      contentType: 'text/markdown; charset=utf-8',
      body: renderMarkdown(input),
    };
  }

  // ─── Role validation ────────────────────────────────────────────────────

  /**
   * Three checks, all before the webhook row exists:
   *  1. the roles exist
   *  2. they belong to a server the project can access — otherwise a role
   *     from an unrelated guild becomes a privilege-escalation path
   *  3. they are not bot-managed (warn only)
   */
  private async assertRolesGrantable(
    projectId: string,
    roleIds: string[],
  ): Promise<void> {
    const unique = Array.from(new Set(roleIds));
    const found = await this.repository.findExistingRoles(unique);

    const foundIds = new Set(found.map((r) => r.id));
    const unknown = unique.filter((id) => !foundIds.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown role IDs: ${unknown.join(', ')}`);
    }

    const projectServerIds = new Set(
      await this.repository.findProjectServerIds(projectId),
    );
    const foreign = found.filter((r) => !projectServerIds.has(r.serverId));
    if (foreign.length > 0) {
      throw new BadRequestException(
        `These roles belong to servers this project cannot access: ${foreign
          .map((r) => `${r.name} (${r.id})`)
          .join(', ')}`,
      );
    }

    const managed = found.filter((r) => r.managed);
    if (managed.length > 0) {
      this.logger.warn(
        `Granting read access via bot-managed role(s): ${managed
          .map((r) => r.name)
          .join(', ')}. This is rarely intended.`,
      );
    }
  }

  // ─── Read access ────────────────────────────────────────────────────────

  /**
   * Returns the role IDs permitted to read this webhook, memoised in Redis.
   * The MEMBER's own roles are deliberately not cached — a cached membership
   * lets someone stripped of a role keep reading until the TTL expires.
   */
  async getAllowedRoleIdsCached(webhookId: string): Promise<string[]> {
    const key = `iwh:roles:${webhookId}`;
    const cached = await this.redisService.getJson<string[]>(key);
    if (cached) return cached;

    const roleIds = await this.repository.findAllowedRoleIds(webhookId);
    await this.redisService.setJson(key, roleIds, 300_000);
    return roleIds;
  }

  private async invalidateRoleCache(webhookId: string): Promise<void> {
    await this.redisService.delete(`iwh:roles:${webhookId}`);
  }

  async listReadableByMember(memberId: string): Promise<InboundWebhookRow[]> {
    return this.repository.listReadableByMember(memberId);
  }

  async listSubmissions(
    webhookId: string,
    filters: ListSubmissionsFilters,
    memberId: string,
    matchedViaRoleId: string | null,
  ) {
    const { rows, total } = await this.repository.listSubmissions(
      webhookId,
      filters,
    );

    await this.audit({
      action: 'submissions.read',
      entityId: webhookId,
      actorId: memberId,
      details: { count: rows.length, total, filters, matchedViaRoleId },
    });

    return {
      submissions: rows.map((r) => ({
        id: r.id,
        payload: r.payload,
        receivedAt: r.receivedAt.toISOString(),
        origin: r.origin,
      })),
      total,
      limit: filters.limit,
      offset: filters.offset,
    };
  }

  async getSubmission(
    webhookId: string,
    submissionId: string,
    memberId: string,
  ) {
    const row = await this.repository.findSubmission(webhookId, submissionId);
    if (!row) throw new NotFoundException('Submission not found');

    await this.audit({
      action: 'submissions.read',
      entityId: webhookId,
      actorId: memberId,
      details: { submissionId },
    });

    return {
      id: row.id,
      payload: row.payload,
      receivedAt: row.receivedAt.toISOString(),
      origin: row.origin,
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
    };
  }

  async auditReadDenied(webhookId: string, memberId: string): Promise<void> {
    await this.audit({
      action: 'read.denied',
      entityId: webhookId,
      actorId: memberId,
      severity: 'warning',
    });
  }

  // ─── Ingest ─────────────────────────────────────────────────────────────

  /**
   * The full check chain, in order. Each failure maps to a distinct status so
   * a caller can debug their integration without guessing.
   */
  async ingest(
    webhookId: string,
    body: Record<string, unknown>,
    ctx: IngestContext,
  ) {
    const webhook = await this.repository.findByIdWithSecret(webhookId);

    // 404 — never confirm that a webhook belonging to another project exists
    if (!webhook || webhook.projectId !== ctx.projectId) {
      throw new NotFoundException('Inbound webhook not found');
    }
    if (!webhook.isActive) {
      throw new GoneException('This webhook is no longer active');
    }

    this.assertOriginAllowed(webhook, ctx.origin);
    await this.assertSignature(webhook, ctx);
    await this.assertWithinRateLimit(webhookId, ctx.projectId);

    const fileIds = collectFileIds(body);
    const files = await this.loadFileMetas(fileIds);

    const result = validatePayload(webhook.schema, body, {
      rejectUnknownFields: webhook.rejectUnknownFields,
      files,
      webhookId: webhook.id,
    });

    if (!result.ok) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        error: 'ValidationFailed',
        errors: result.errors,
      });
    }

    const submission = await this.repository.insertSubmission({
      webhookId: webhook.id,
      projectId: webhook.projectId,
      payload: result.value,
      ipAddress: ctx.ipAddress,
      origin: ctx.origin,
      userAgent: ctx.userAgent,
      fileIds: result.fileIds,
    });

    await this.audit({
      action: 'submission.received',
      entityId: webhook.id,
      // The actor is a project, not a member: audit_logs.actor_id is a member FK
      actorId: null,
      details: {
        projectId: webhook.projectId,
        submissionId: submission.id,
        fileCount: result.fileIds.length,
      },
    });

    return {
      id: submission.id,
      receivedAt: submission.receivedAt.toISOString(),
    };
  }

  private assertOriginAllowed(
    webhook: InboundWebhookRow,
    origin: string | undefined,
  ): void {
    if (webhook.acceptedOrigins.length === 0) return;
    if (!origin || !webhook.acceptedOrigins.includes(origin)) {
      throw new ForbiddenException(
        `Origin "${origin ?? 'none'}" is not permitted for this webhook`,
      );
    }
  }

  private async assertSignature(
    webhook: InboundWebhookRow & { signingSecretEnc: string },
    ctx: IngestContext,
  ): Promise<void> {
    if (!webhook.requireSignature) return;

    if (!ctx.rawBody) {
      throw new BadRequestException(
        'Raw request body unavailable; cannot verify the signature',
      );
    }

    const secret = decryptSecret(webhook.signingSecretEnc);
    const tolerance = this.configService.get<number>(
      'INBOUND_WEBHOOK_SIGNATURE_TOLERANCE_S',
      300,
    );

    const result = verifySignature({
      header: ctx.signatureHeader,
      secret,
      rawBody: ctx.rawBody,
      toleranceSeconds: tolerance,
    });

    if (!result.ok) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'InvalidSignature',
        reason: result.reason,
      });
    }

    // Replay protection: the same signature may be presented only once within
    // the tolerance window.
    //
    // Deliberately fails OPEN when Redis is unreachable. Treating "no answer"
    // as "already seen" would turn a cache blip into a total ingest outage,
    // which is a worse failure than briefly allowing a replay of an
    // already-authenticated request.
    const key = `${REPLAY_PREFIX}${webhook.id}:${result.parsed.signature}`;
    const state = await this.redisService.setIfAbsent(
      key,
      '1',
      tolerance * 1000,
    );
    if (state === 'exists') {
      throw new ConflictException('This request has already been processed');
    }
    if (state === 'unavailable') {
      this.logger.warn(
        `Replay protection skipped for webhook ${webhook.id}: Redis unavailable`,
      );
    }
  }

  private async assertWithinRateLimit(
    webhookId: string,
    projectId: string,
  ): Promise<void> {
    const limit = this.configService.get<number>(
      'INBOUND_WEBHOOK_RATE_LIMIT',
      120,
    );
    for (const scope of [`w:${webhookId}`, `p:${projectId}`]) {
      const key = `${RATE_PREFIX}${scope}:${Math.floor(Date.now() / 60_000)}`;
      const count = await this.redisService.incr(key);
      // RedisService.incr returns 0 when Redis did not answer; a real INCR
      // always returns >= 1. Skip the limit rather than reject, for the same
      // reason replay protection fails open.
      if (count === 0) return;
      if (count === 1) await this.redisService.expire(key, 120);
      if (count > limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            error: 'RateLimited',
            message: `Rate limit of ${limit} requests per minute exceeded`,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
  }

  private async loadFileMetas(ids: string[]): Promise<Map<string, FileMeta>> {
    const rows = await this.repository.findFilesByIds(ids);
    return new Map(
      rows.map((r) => [
        r.id,
        {
          id: r.id,
          webhookId: r.webhookId,
          mime: r.mime,
          sizeBytes: r.sizeBytes,
          status: r.status,
          expiresAt: r.expiresAt,
        },
      ]),
    );
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * The externally reachable API root, prefix included.
   *
   * `app.baseUrl` is the host only — main.ts applies `app.apiPrefix` as a
   * global prefix separately, and strips it back off again for Swagger.
   * Documented URLs must carry it, or every example a developer copies 404s.
   */
  private baseUrl(): string {
    const host = (
      this.configService.get<string>('app.baseUrl') ?? 'http://localhost:3000'
    ).replace(/\/+$/, '');
    const prefix = (
      this.configService.get<string>('app.apiPrefix') ?? 'api'
    ).replace(/^\/+|\/+$/g, '');

    if (!prefix || host.endsWith(`/${prefix}`)) return host;
    return `${host}/${prefix}`;
  }

  private assertValidSchema(raw: unknown): FormSchema {
    const result = validateSchema(raw);
    if (!result.ok) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'InvalidSchema',
        errors: result.errors,
      });
    }
    return raw as FormSchema;
  }

  private async audit(entry: {
    action: string;
    entityId: string;
    actorId?: string | null;
    details?: Record<string, unknown>;
    severity?: 'info' | 'warning' | 'error';
  }): Promise<void> {
    try {
      await this.auditRepository.insert({
        actionType: 'webhook',
        action: entry.action,
        entityType: 'inbound_webhook',
        entityId: entry.entityId,
        actorId: entry.actorId ?? null,
        details: entry.details ?? null,
        severity: entry.severity ?? 'info',
      });
    } catch (error: unknown) {
      // Auditing must never break the request it is recording.
      this.logger.warn(
        `Failed to write audit entry ${entry.action}: ${String(error)}`,
      );
    }
  }
}

/** Walks a payload collecting every `{ fileId }` reference, at any depth. */
function collectFileIds(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectFileIds(item, acc);
    return acc;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.fileId === 'string') {
      acc.push(record.fileId);
      return acc;
    }
    for (const v of Object.values(record)) collectFileIds(v, acc);
  }
  return acc;
}
