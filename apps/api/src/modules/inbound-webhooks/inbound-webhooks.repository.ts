import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, lte, sql, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import {
  inboundWebhookFiles,
  inboundWebhookRoles,
  inboundWebhookSubmissions,
  inboundWebhooks,
  projectServers,
  roles,
  serverMemberRoles,
} from '../../database/entities';
import type { FormSchema } from './schema/form-schema.types';

export interface InboundWebhookRow {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  schema: FormSchema;
  acceptedOrigins: string[];
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  allowRoleInheritance: boolean;
  isActive: boolean;
  submissionCount: number;
  lastSubmissionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** The public projection — never carries the signing secret. */
const PUBLIC_COLUMNS = {
  id: inboundWebhooks.id,
  projectId: inboundWebhooks.projectId,
  name: inboundWebhooks.name,
  slug: inboundWebhooks.slug,
  schema: inboundWebhooks.schema,
  acceptedOrigins: inboundWebhooks.acceptedOrigins,
  requireSignature: inboundWebhooks.requireSignature,
  rejectUnknownFields: inboundWebhooks.rejectUnknownFields,
  allowRoleInheritance: inboundWebhooks.allowRoleInheritance,
  isActive: inboundWebhooks.isActive,
  submissionCount: inboundWebhooks.submissionCount,
  lastSubmissionAt: inboundWebhooks.lastSubmissionAt,
  createdAt: inboundWebhooks.createdAt,
  updatedAt: inboundWebhooks.updatedAt,
};

export interface CreateInboundWebhookData {
  projectId: string;
  name: string;
  slug: string;
  schema: FormSchema;
  acceptedOrigins: string[];
  signingSecretEnc: string;
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  allowRoleInheritance: boolean;
  createdBy: string | null;
  allowedRoleIds: string[];
}

export interface ListSubmissionsFilters {
  limit: number;
  offset: number;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class InboundWebhooksRepository {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ─── Webhooks ───────────────────────────────────────────────────────────

  /**
   * Creates the webhook and its role grants in one transaction. A webhook
   * that exists without its role gate — even for a moment — is an open webhook.
   */
  async create(data: CreateInboundWebhookData): Promise<InboundWebhookRow> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(inboundWebhooks)
        .values({
          projectId: data.projectId,
          name: data.name,
          slug: data.slug,
          schema: data.schema,
          acceptedOrigins: data.acceptedOrigins,
          signingSecretEnc: data.signingSecretEnc,
          requireSignature: data.requireSignature,
          rejectUnknownFields: data.rejectUnknownFields,
          allowRoleInheritance: data.allowRoleInheritance,
          createdBy: data.createdBy,
        })
        .returning(PUBLIC_COLUMNS);

      await tx.insert(inboundWebhookRoles).values(
        data.allowedRoleIds.map((roleId) => ({
          webhookId: row.id,
          roleId,
          grantedBy: data.createdBy,
        })),
      );

      return row as InboundWebhookRow;
    });
  }

  async findById(id: string): Promise<InboundWebhookRow | null> {
    const [row] = await this.db
      .select(PUBLIC_COLUMNS)
      .from(inboundWebhooks)
      .where(eq(inboundWebhooks.id, id))
      .limit(1);
    return (row as InboundWebhookRow) ?? null;
  }

  /** Includes the encrypted secret — for ingest signature verification only. */
  async findByIdWithSecret(
    id: string,
  ): Promise<(InboundWebhookRow & { signingSecretEnc: string }) | null> {
    const [row] = await this.db
      .select({
        ...PUBLIC_COLUMNS,
        signingSecretEnc: inboundWebhooks.signingSecretEnc,
      })
      .from(inboundWebhooks)
      .where(eq(inboundWebhooks.id, id))
      .limit(1);
    return (row as InboundWebhookRow & { signingSecretEnc: string }) ?? null;
  }

  async listByProject(projectId: string): Promise<InboundWebhookRow[]> {
    const rows = await this.db
      .select(PUBLIC_COLUMNS)
      .from(inboundWebhooks)
      .where(eq(inboundWebhooks.projectId, projectId))
      .orderBy(desc(inboundWebhooks.createdAt));
    return rows as InboundWebhookRow[];
  }

  async listAll(): Promise<InboundWebhookRow[]> {
    const rows = await this.db
      .select(PUBLIC_COLUMNS)
      .from(inboundWebhooks)
      .orderBy(desc(inboundWebhooks.createdAt));
    return rows as InboundWebhookRow[];
  }

  /**
   * Lists only the webhooks readable by a member, filtered INSIDE the query.
   * Fetch-then-filter would leak the total count of webhooks the caller
   * cannot see.
   */
  async listReadableByMember(memberId: string): Promise<InboundWebhookRow[]> {
    const rows = await this.db
      .selectDistinct(PUBLIC_COLUMNS)
      .from(inboundWebhooks)
      .innerJoin(
        inboundWebhookRoles,
        eq(inboundWebhookRoles.webhookId, inboundWebhooks.id),
      )
      .innerJoin(
        serverMemberRoles,
        eq(serverMemberRoles.roleId, inboundWebhookRoles.roleId),
      )
      .where(eq(serverMemberRoles.memberId, memberId))
      .orderBy(desc(inboundWebhooks.createdAt));
    return rows as InboundWebhookRow[];
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      schema: FormSchema;
      acceptedOrigins: string[];
      requireSignature: boolean;
      rejectUnknownFields: boolean;
      allowRoleInheritance: boolean;
      isActive: boolean;
    }>,
  ): Promise<InboundWebhookRow | null> {
    const [row] = await this.db
      .update(inboundWebhooks)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inboundWebhooks.id, id))
      .returning(PUBLIC_COLUMNS);
    return (row as InboundWebhookRow) ?? null;
  }

  async updateSecret(id: string, signingSecretEnc: string): Promise<void> {
    await this.db
      .update(inboundWebhooks)
      .set({ signingSecretEnc, updatedAt: new Date() })
      .where(eq(inboundWebhooks.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(inboundWebhooks)
      .where(eq(inboundWebhooks.id, id))
      .returning({ id: inboundWebhooks.id });
    return rows.length > 0;
  }

  async findBySlug(
    projectId: string,
    slug: string,
  ): Promise<InboundWebhookRow | null> {
    const [row] = await this.db
      .select(PUBLIC_COLUMNS)
      .from(inboundWebhooks)
      .where(
        and(
          eq(inboundWebhooks.projectId, projectId),
          eq(inboundWebhooks.slug, slug),
        ),
      )
      .limit(1);
    return (row as InboundWebhookRow) ?? null;
  }

  // ─── Role grants ────────────────────────────────────────────────────────

  async findAllowedRoleIds(webhookId: string): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: inboundWebhookRoles.roleId })
      .from(inboundWebhookRoles)
      .where(eq(inboundWebhookRoles.webhookId, webhookId));
    return rows.map((r) => r.roleId);
  }

  async findAllowedRoles(webhookId: string) {
    return this.db
      .select({
        roleId: inboundWebhookRoles.roleId,
        roleName: roles.name,
        roleColor: roles.color,
        serverId: roles.serverId,
        grantedAt: inboundWebhookRoles.grantedAt,
        grantedBy: inboundWebhookRoles.grantedBy,
      })
      .from(inboundWebhookRoles)
      .innerJoin(roles, eq(inboundWebhookRoles.roleId, roles.id))
      .where(eq(inboundWebhookRoles.webhookId, webhookId));
  }

  async replaceAllowedRoles(
    webhookId: string,
    roleIds: string[],
    grantedBy: string | null,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(inboundWebhookRoles)
        .where(eq(inboundWebhookRoles.webhookId, webhookId));
      await tx
        .insert(inboundWebhookRoles)
        .values(roleIds.map((roleId) => ({ webhookId, roleId, grantedBy })));
    });
  }

  // ─── Role lookups used by the read guard ────────────────────────────────

  /** Roles that actually exist, of those requested. */
  async findExistingRoles(roleIds: string[]) {
    if (roleIds.length === 0) return [];
    return this.db
      .select({
        id: roles.id,
        serverId: roles.serverId,
        name: roles.name,
        managed: roles.managed,
      })
      .from(roles)
      .where(inArray(roles.id, roleIds));
  }

  /** Server IDs a project has an access mapping for. */
  async findProjectServerIds(projectId: string): Promise<string[]> {
    const rows = await this.db
      .select({ serverId: projectServers.serverId })
      .from(projectServers)
      .where(eq(projectServers.projectId, projectId));
    return rows.map((r) => r.serverId);
  }

  /**
   * A member's plain role IDs. Nothing existing returns this — the joins in
   * permissions.repository.ts all answer a *permission* question instead.
   */
  async findMemberRoleIds(memberId: string): Promise<string[]> {
    const rows = await this.db
      .select({ roleId: serverMemberRoles.roleId })
      .from(serverMemberRoles)
      .where(eq(serverMemberRoles.memberId, memberId));
    return rows.map((r) => r.roleId);
  }

  // ─── Submissions ────────────────────────────────────────────────────────

  async insertSubmission(data: {
    webhookId: string;
    projectId: string;
    draftId?: string | null;
    payload: Record<string, unknown>;
    ipAddress?: string | null;
    origin?: string | null;
    userAgent?: string | null;
    fileIds: string[];
  }) {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(inboundWebhookSubmissions)
        .values({
          webhookId: data.webhookId,
          projectId: data.projectId,
          draftId: data.draftId ?? null,
          payload: data.payload,
          ipAddress: data.ipAddress ?? null,
          origin: data.origin ?? null,
          userAgent: data.userAgent ?? null,
        })
        .returning();

      if (data.fileIds.length > 0) {
        await tx
          .update(inboundWebhookFiles)
          .set({ status: 'committed', submissionId: row.id })
          .where(inArray(inboundWebhookFiles.id, data.fileIds));
      }

      await tx
        .update(inboundWebhooks)
        .set({
          submissionCount: sql`${inboundWebhooks.submissionCount} + 1`,
          lastSubmissionAt: row.receivedAt,
        })
        .where(eq(inboundWebhooks.id, data.webhookId));

      return row;
    });
  }

  async listSubmissions(webhookId: string, filters: ListSubmissionsFilters) {
    const conditions: SQL[] = [
      eq(inboundWebhookSubmissions.webhookId, webhookId),
    ];
    if (filters.dateFrom) {
      conditions.push(
        gte(inboundWebhookSubmissions.receivedAt, new Date(filters.dateFrom)),
      );
    }
    if (filters.dateTo) {
      conditions.push(
        lte(inboundWebhookSubmissions.receivedAt, new Date(filters.dateTo)),
      );
    }
    const where = and(...conditions);

    const [rows, [{ count }]] = await Promise.all([
      this.db
        .select()
        .from(inboundWebhookSubmissions)
        .where(where)
        .orderBy(desc(inboundWebhookSubmissions.receivedAt))
        .limit(filters.limit)
        .offset(filters.offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(inboundWebhookSubmissions)
        .where(where),
    ]);

    return { rows, total: count };
  }

  async findSubmission(webhookId: string, submissionId: string) {
    const [row] = await this.db
      .select()
      .from(inboundWebhookSubmissions)
      .where(
        and(
          eq(inboundWebhookSubmissions.id, submissionId),
          eq(inboundWebhookSubmissions.webhookId, webhookId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  // ─── Files ──────────────────────────────────────────────────────────────

  async findFilesByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(inboundWebhookFiles)
      .where(inArray(inboundWebhookFiles.id, ids));
  }
}
