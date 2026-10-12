import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isUUID } from 'class-validator';
import { AuditRepository } from '../audit/audit.repository';
import { DrizzleDB } from '../../database/database.constants';
import { RedisService } from '../../common/redis/redis.service';
import {
  encryptSecret,
  decryptSecret,
} from '../../common/utils/encryption.util';
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
import type { SchemaError } from './schema/schema.validator';
import { validatePayload, FileMeta } from './schema/payload.validator';
import type { FormSchema } from './schema/form-schema.types';
import { CreateInboundWebhookDto } from './dto/create-inbound-webhook.dto';
import {
  buildExamplePayload,
  renderMarkdown,
  renderOpenApi,
  WebhookDocsInput,
} from './docs/webhook-docs.generator';
import { PreviewInboundWebhookSchemaDto } from './dto/preview-inbound-webhook-schema.dto';
import { UpdateInboundWebhookDto } from './dto/update-inbound-webhook.dto';

export interface CreateInboundWebhookResult {
  webhook: InboundWebhookRow;
  /** Returned ONCE — never stored in plaintext, never returned again */
  signingSecret: string;
  allowedRoleIds: string[];
  /** Where to send this webhook's submissions. */
  submitUrl: string;
  /** Link to auto-generated documentation. */
  docsUrl: string;
}

export interface PreparedWebhookData {
  name: string;
  slug: string;
  schema: FormSchema;
  acceptedOrigins: string[];
  signingSecret: string;
  signingSecretEnc: string;
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  allowRoleInheritance: boolean;
  allowedRoleIds: string[];
  actor: string | null;
}

export type DocsFormat = 'markdown' | 'openapi';

export type SchemaPreviewResult =
  | { ok: false; errors: SchemaError[] }
  | {
      ok: true;
      markdown: string;
      examplePayload: Record<string, unknown>;
    };

export interface InboundWebhookSettingsView {
  /** The effective default reader roles; may include roles that no longer exist. */
  defaultReaderRoleIds: string[];
  /** The ones that still exist, with their names, for display. */
  defaultReaderRoles: {
    id: string;
    name: string;
    serverId: string;
    serverName: string;
  }[];
  /** `environment` until the setting is first saved. */
  source: 'settings' | 'environment';
  updatedAt: string | null;
  updatedBy: string | null;
}

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

  async prepare(
    dto: Omit<CreateInboundWebhookDto, 'projectId'>,
    actor: string | null,
    skipSlugConflictCheck = false,
    projectId?: string,
    skipServerAccessCheck = false,
  ): Promise<PreparedWebhookData> {
    const formSchema = this.assertValidSchema(dto.schema);

    if (!skipSlugConflictCheck && projectId) {
      const existing = await this.repository.findBySlug(projectId, dto.slug);
      if (existing) {
        throw new ConflictException(
          `Project already has a webhook with slug "${dto.slug}"`,
        );
      }
    }

    const allowedRoleIds = await this.resolveReaderRoles(
      projectId ?? 'new-project',
      dto.allowedRoleIds,
      skipServerAccessCheck,
    );

    const signingSecret = generateSigningSecret();

    return {
      name: dto.name,
      slug: dto.slug,
      schema: formSchema,
      acceptedOrigins: dto.acceptedOrigins ?? [],
      signingSecret,
      signingSecretEnc: encryptSecret(signingSecret, this.encryptionKey()),
      requireSignature: dto.requireSignature ?? true,
      rejectUnknownFields: dto.rejectUnknownFields ?? true,
      allowRoleInheritance: dto.allowRoleInheritance ?? false,
      allowedRoleIds,
      actor,
    };
  }

  async persist(
    projectId: string,
    prepared: PreparedWebhookData,
    tx?: DrizzleDB,
  ): Promise<CreateInboundWebhookResult> {
    const webhook = await this.repository.create(
      {
        projectId,
        name: prepared.name,
        slug: prepared.slug,
        schema: prepared.schema,
        acceptedOrigins: prepared.acceptedOrigins,
        signingSecretEnc: prepared.signingSecretEnc,
        requireSignature: prepared.requireSignature,
        rejectUnknownFields: prepared.rejectUnknownFields,
        allowRoleInheritance: prepared.allowRoleInheritance,
        createdBy: prepared.actor,
        allowedRoleIds: prepared.allowedRoleIds,
      },
      tx,
    );

    await this.audit({
      action: 'webhook.created',
      entityId: webhook.id,
      actorId: prepared.actor,
      details: {
        projectId,
        slug: prepared.slug,
        allowedRoleIds: prepared.allowedRoleIds,
      },
    });

    const baseUrl = this.baseUrl();
    return {
      webhook,
      signingSecret: prepared.signingSecret,
      allowedRoleIds: prepared.allowedRoleIds,
      submitUrl: `${baseUrl}/inbound-webhooks/${webhook.id}/submit`,
      docsUrl: `${baseUrl}/admin/inbound-webhooks/${webhook.id}/docs`,
    };
  }

  async create(
    dto: CreateInboundWebhookDto,
    actor: string | null,
  ): Promise<CreateInboundWebhookResult> {
    const prepared = await this.prepare(
      dto,
      actor,
      false,
      dto.projectId,
      false,
    );
    return this.persist(dto.projectId, prepared);
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

    await this.assertRolesGrantable(
      webhook.projectId,
      roleIds,
      new Set(await this.getDefaultReaderRoleIds()),
      false,
    );

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
    await this.repository.updateSecret(
      id,
      encryptSecret(signingSecret, this.encryptionKey()),
    );
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
  /**
   * `exempt` are the configured default reader roles: they may be granted even
   * when their server (the main one, for the executive role) is not one the
   * project can access. Every other role is checked against the project.
   */
  private async assertRolesGrantable(
    projectId: string,
    roleIds: string[],
    exempt: Set<string> = new Set(),
    skipServerAccessCheck = false,
  ): Promise<void> {
    const unique = Array.from(new Set(roleIds));
    const found = await this.repository.findExistingRoles(unique);

    const foundIds = new Set(found.map((r) => r.id));
    const unknown = unique.filter((id) => !foundIds.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown role IDs: ${unknown.join(', ')}`);
    }

    if (skipServerAccessCheck) return;

    const projectServerIds = new Set(
      await this.repository.findProjectServerIds(projectId),
    );
    const foreign = found.filter(
      (r) => !projectServerIds.has(r.serverId) && !exempt.has(r.id),
    );
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
    const replayKey = await this.assertSignature(webhook, ctx);

    try {
      return await this.store(webhook, body, ctx);
    } catch (error) {
      // Nothing was stored, so the same signed request may be sent again.
      if (replayKey) await this.redisService.delete(replayKey);
      throw error;
    }
  }

  private async store(
    webhook: InboundWebhookRow,
    body: Record<string, unknown>,
    ctx: IngestContext,
  ) {
    await this.assertWithinRateLimit(webhook.id, ctx.projectId);

    // The id column is a uuid: anything else cannot match a row, and asking
    // Postgres about it fails the whole request instead of the one field.
    const fileIds = [...new Set(collectFileIds(body))].filter((id) =>
      isUUID(id),
    );
    const files = await this.loadFileMetas(fileIds);

    const result = validatePayload(webhook.schema, body, {
      rejectUnknownFields: webhook.rejectUnknownFields,
      files,
      webhookId: webhook.id,
    });

    if (!result.ok) {
      const timedOut = result.errors.find((e) => e.code === 'PATTERN_TIMEOUT');
      if (timedOut) {
        // The stored pattern is the fault, not the caller: an admin has to fix it.
        this.logger.warn(
          `Pattern timed out on webhook ${webhook.id} at ${timedOut.path}`,
        );
      }
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

  /** Returns the replay key it claimed, so a failed request can release it. */
  private async assertSignature(
    webhook: InboundWebhookRow & { signingSecretEnc: string },
    ctx: IngestContext,
  ): Promise<string | null> {
    if (!webhook.requireSignature) return null;

    if (!ctx.rawBody) {
      throw new BadRequestException(
        'Raw request body unavailable; cannot verify the signature',
      );
    }

    const secret = decryptSecret(
      webhook.signingSecretEnc,
      this.encryptionKey(),
    );
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

    // Replay protection: the same signature may be presented only once for as
    // long as it verifies. That is until t + tolerance, and t may itself be up
    // to `tolerance` ahead of our clock, hence a key that lives twice as long.
    //
    // Deliberately fails OPEN when Redis is unreachable. Treating "no answer"
    // as "already seen" would turn a cache blip into a total ingest outage,
    // which is a worse failure than briefly allowing a replay of an
    // already-authenticated request.
    const key = `${REPLAY_PREFIX}${webhook.id}:${result.parsed.signature}`;
    const state = await this.redisService.setIfAbsent(
      key,
      '1',
      tolerance * 2 * 1000,
    );
    if (state === 'exists') {
      throw new ConflictException('This request has already been processed');
    }
    if (state === 'unavailable') {
      this.logger.warn(
        `Replay protection skipped for webhook ${webhook.id}: Redis unavailable`,
      );
      return null;
    }
    return key;
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

  // ─── Schema preview ─────────────────────────────────────────────────────

  /**
   * Checks a schema and renders its docs without saving anything, for the
   * admin editor. It runs the same `validateSchema` as `create`, so a preview
   * and a create can never disagree. What only exists once the webhook is
   * saved (its ID, its readers) is a placeholder.
   */
  previewSchema(dto: PreviewInboundWebhookSchemaDto): SchemaPreviewResult {
    const checked = validateSchema(dto.schema);
    if (!checked.ok) return { ok: false, errors: checked.errors };

    const schema = dto.schema as unknown as FormSchema;
    const input: WebhookDocsInput = {
      id: '<webhook-id>',
      name: dto.name?.trim() || 'Inbound webhook',
      slug: '<slug>',
      schema,
      acceptedOrigins: dto.acceptedOrigins ?? [],
      requireSignature: dto.requireSignature ?? true,
      rejectUnknownFields: dto.rejectUnknownFields ?? true,
      isActive: true,
      createdAt: new Date(),
      allowedRoles: [],
      baseUrl: this.baseUrl(),
    };

    return {
      ok: true,
      markdown: renderMarkdown(input),
      examplePayload: buildExamplePayload(schema),
    };
  }

  // ─── Settings ───────────────────────────────────────────────────────────

  /**
   * The reader roles a new webhook gets when its creator names none: the saved
   * setting, or the executive role while nothing has been saved.
   */
  async getDefaultReaderRoleIds(): Promise<string[]> {
    const row = await this.repository.getSettings();
    return row?.defaultReaderRoleIds ?? this.environmentDefaultReaders();
  }

  private environmentDefaultReaders(): string[] {
    const executive = this.configService.get<string>('discord.executiveRoleId');
    return executive ? [executive] : [];
  }

  async getSettings(): Promise<InboundWebhookSettingsView> {
    const row = await this.repository.getSettings();
    const stored = row?.defaultReaderRoleIds ?? null;
    const defaultReaderRoleIds = stored ?? this.environmentDefaultReaders();

    const found = new Map(
      (await this.repository.findExistingRoles(defaultReaderRoleIds)).map(
        (role) => [role.id, role],
      ),
    );

    return {
      defaultReaderRoleIds,
      defaultReaderRoles: defaultReaderRoleIds.flatMap((id) => {
        const role = found.get(id);
        return role
          ? [
              {
                id,
                name: role.name,
                serverId: role.serverId,
                serverName: role.serverName,
              },
            ]
          : [];
      }),
      source: stored === null ? 'environment' : 'settings',
      updatedAt: row?.updatedAt.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
    };
  }

  async updateSettings(
    defaultReaderRoleIds: string[],
    actor: string | null,
  ): Promise<InboundWebhookSettingsView> {
    const roleIds = [...new Set(defaultReaderRoleIds)];

    const known = new Set(
      (await this.repository.findExistingRoles(roleIds)).map((r) => r.id),
    );
    const unknown = roleIds.filter((id) => !known.has(id));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown role IDs: ${unknown.join(', ')}`);
    }

    const previous = await this.getDefaultReaderRoleIds();
    await this.repository.upsertSettings(roleIds, actor);

    await this.audit({
      action: 'settings.updated',
      entityType: 'inbound_webhook_settings',
      entityId: 'settings',
      actorId: actor,
      details: { from: previous, to: roleIds },
    });

    return this.getSettings();
  }

  /**
   * The readers a new webhook is created with: exactly the roles the creator
   * named, or the defaults when it named none. A default that no longer exists
   * is skipped. Either way at least one role must remain.
   */
  private async resolveReaderRoles(
    projectId: string,
    requested: string[] | undefined,
    skipServerAccessCheck = false,
  ): Promise<string[]> {
    const defaults = await this.getDefaultReaderRoleIds();

    if (requested !== undefined) {
      const roleIds = [...new Set(requested)];
      if (roleIds.length === 0) throw this.noReaders();
      await this.assertRolesGrantable(
        projectId,
        roleIds,
        new Set(defaults),
        skipServerAccessCheck,
      );
      return roleIds;
    }

    const existing = new Set(
      (await this.repository.findExistingRoles(defaults)).map((r) => r.id),
    );
    const usable = defaults.filter((id) => existing.has(id));
    if (usable.length === 0) throw this.noReaders();
    return usable;
  }

  private noReaders(): BadRequestException {
    return new BadRequestException(
      'At least one reader role is required: name one, or configure default reader roles in the inbound webhook settings.',
    );
  }

  private encryptionKey(): string {
    const key = this.configService.get<string>(
      'app.inboundWebhookEncryptionKey',
    );
    if (!key) {
      throw new InternalServerErrorException({
        code: 'ENCRYPTION_KEY_MISSING',
        message: 'INBOUND_WEBHOOK_ENCRYPTION_KEY is not configured',
      });
    }
    return key;
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
    entityType?: string;
    entityId: string;
    actorId?: string | null;
    details?: Record<string, unknown>;
    severity?: 'info' | 'warning' | 'error';
  }): Promise<void> {
    try {
      await this.auditRepository.insert({
        actionType: 'webhook',
        action: entry.action,
        entityType: entry.entityType ?? 'inbound_webhook',
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
