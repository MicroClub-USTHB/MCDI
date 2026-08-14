import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../../database/database.module';
import * as schema from '../../database/entities';
import {
  members,
  roles,
  serverMemberRoles,
  serverMembers,
  serverSyncLogs,
  servers,
} from '../../database/entities';

type GrowthUnit = 'day' | 'week' | 'month';

@Injectable()
export class StatsRepository {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  // ── Scalar member counts (optionally scoped to one server) ──────────────

  async countMembers(serverId?: string): Promise<number> {
    if (serverId) {
      const [r] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(serverMembers)
        .where(eq(serverMembers.serverId, serverId));
      return r?.value ?? 0;
    }
    const [r] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(members);
    return r?.value ?? 0;
  }

  async countClubMembers(serverId?: string): Promise<number> {
    if (serverId) {
      const [r] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(serverMembers)
        .innerJoin(members, eq(members.id, serverMembers.memberId))
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(members.isClubMember, true),
          ),
        );
      return r?.value ?? 0;
    }
    const [r] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(eq(members.isClubMember, true));
    return r?.value ?? 0;
  }

  /** Active = present in at least one server with an active membership. */
  async countActiveMembers(serverId?: string): Promise<number> {
    if (serverId) {
      const [r] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(serverMembers)
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            eq(serverMembers.isActive, true),
          ),
        );
      return r?.value ?? 0;
    }
    const [r] = await this.db
      .select({
        value: sql<number>`count(distinct ${serverMembers.memberId})::int`,
      })
      .from(serverMembers)
      .where(eq(serverMembers.isActive, true));
    return r?.value ?? 0;
  }

  async countNewMembers(since: Date, serverId?: string): Promise<number> {
    if (serverId) {
      const [r] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(serverMembers)
        .innerJoin(members, eq(members.id, serverMembers.memberId))
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            gte(members.createdAt, since),
          ),
        );
      return r?.value ?? 0;
    }
    const [r] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(gte(members.createdAt, since));
    return r?.value ?? 0;
  }

  async countMembersBefore(date: Date, serverId?: string): Promise<number> {
    if (serverId) {
      const [r] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(serverMembers)
        .innerJoin(members, eq(members.id, serverMembers.memberId))
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            lt(members.createdAt, date),
          ),
        );
      return r?.value ?? 0;
    }
    const [r] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(members)
      .where(lt(members.createdAt, date));
    return r?.value ?? 0;
  }

  // ── Grouped breakdowns ──────────────────────────────────────────────────

  async membersByServer(serverId?: string) {
    return this.db
      .select({
        serverId: serverMembers.serverId,
        serverName: servers.name,
        memberCount: sql<number>`count(*)::int`,
      })
      .from(serverMembers)
      .innerJoin(servers, eq(servers.id, serverMembers.serverId))
      .where(serverId ? eq(serverMembers.serverId, serverId) : undefined)
      .groupBy(serverMembers.serverId, servers.name)
      .orderBy(desc(sql`count(*)`));
  }

  /** Roles are server-scoped rows; we group by name so a role shared across
   *  servers (e.g. "Member") aggregates into one row when unscoped. */
  async membersByRole(serverId?: string) {
    return this.db
      .select({
        roleName: roles.name,
        count: sql<number>`count(*)::int`,
      })
      .from(serverMemberRoles)
      .innerJoin(roles, eq(roles.id, serverMemberRoles.roleId))
      .where(serverId ? eq(roles.serverId, serverId) : undefined)
      .groupBy(roles.name)
      .orderBy(desc(sql`count(*)`));
  }

  /** New-member counts bucketed by day/week/month. `unit` is a fixed literal
   *  (never user input) so inlining it is injection-safe and keeps the SELECT
   *  and GROUP BY expressions identical. */
  async memberGrowthBuckets(since: Date, unit: GrowthUnit, serverId?: string) {
    const bucket = sql<string>`date_trunc(${sql.raw(`'${unit}'`)}, ${members.createdAt})`;

    if (serverId) {
      return this.db
        .select({ bucket, newMembers: sql<number>`count(*)::int` })
        .from(serverMembers)
        .innerJoin(members, eq(members.id, serverMembers.memberId))
        .where(
          and(
            eq(serverMembers.serverId, serverId),
            gte(members.createdAt, since),
          ),
        )
        .groupBy(bucket)
        .orderBy(bucket);
    }

    return this.db
      .select({ bucket, newMembers: sql<number>`count(*)::int` })
      .from(members)
      .where(gte(members.createdAt, since))
      .groupBy(bucket)
      .orderBy(bucket);
  }

  // ── Role distribution for one server ────────────────────────────────────

  async serverName(serverId: string): Promise<string | null> {
    const [r] = await this.db
      .select({ name: servers.name })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);
    return r?.name ?? null;
  }

  async roleDistribution(serverId: string) {
    return this.db
      .select({
        roleId: roles.id,
        roleName: roles.name,
        hierarchyLevel: roles.hierarchyLevel,
        color: roles.color,
        memberCount: sql<number>`count(${serverMemberRoles.memberId})::int`,
      })
      .from(roles)
      .leftJoin(serverMemberRoles, eq(serverMemberRoles.roleId, roles.id))
      .where(eq(roles.serverId, serverId))
      .groupBy(roles.id)
      .orderBy(desc(roles.position));
  }

  // ── Server-level overview ───────────────────────────────────────────────

  async listServers() {
    return this.db
      .select({ serverId: servers.id, serverName: servers.name })
      .from(servers)
      .orderBy(servers.name);
  }

  async memberCountsByServer() {
    return this.db
      .select({
        serverId: serverMembers.serverId,
        memberCount: sql<number>`count(*)::int`,
        activeMembers: sql<number>`count(*) filter (where ${serverMembers.isActive})::int`,
      })
      .from(serverMembers)
      .groupBy(serverMembers.serverId);
  }

  async roleCountsByServer() {
    return this.db
      .select({
        serverId: roles.serverId,
        roleCount: sql<number>`count(*)::int`,
      })
      .from(roles)
      .groupBy(roles.serverId);
  }

  /** Latest sync attempt per server (by startedAt), regardless of outcome —
   *  drives current syncStatus and, when that attempt failed, the surfaced
   *  error message. */
  async latestSyncByServer() {
    return this.db
      .selectDistinctOn([serverSyncLogs.serverId], {
        serverId: serverSyncLogs.serverId,
        status: serverSyncLogs.status,
        finishedAt: serverSyncLogs.finishedAt,
        message: serverSyncLogs.message,
      })
      .from(serverSyncLogs)
      .orderBy(serverSyncLogs.serverId, desc(serverSyncLogs.startedAt));
  }

  /** Latest *successful* sync per server — may be older than the latest
   *  attempt if that attempt failed. Drives "last successful sync". */
  async latestSuccessfulSyncByServer() {
    return this.db
      .selectDistinctOn([serverSyncLogs.serverId], {
        serverId: serverSyncLogs.serverId,
        finishedAt: serverSyncLogs.finishedAt,
      })
      .from(serverSyncLogs)
      .where(eq(serverSyncLogs.status, 'success'))
      .orderBy(serverSyncLogs.serverId, desc(serverSyncLogs.startedAt));
  }

  async countServers(): Promise<number> {
    const [r] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(servers);
    return r?.value ?? 0;
  }

  // ── Cross-server overlap ────────────────────────────────────────────────

  /** Count of members present in more than one managed server. */
  async countMembersInMultipleServers(): Promise<number> {
    const rows = await this.db
      .select({ memberId: serverMembers.memberId })
      .from(serverMembers)
      .groupBy(serverMembers.memberId)
      .having(sql`count(*) > 1`);
    return rows.length;
  }

  /** Pairwise member-overlap count between every pair of servers, via a
   *  self-join on server_members (sa.server_id < sb.server_id avoids
   *  double-counting each unordered pair and self-pairs). */
  async serverOverlapPairs() {
    const sa = alias(serverMembers, 'sa');
    const sb = alias(serverMembers, 'sb');
    const serverA = alias(servers, 'server_a');
    const serverB = alias(servers, 'server_b');

    return this.db
      .select({
        serverAId: sa.serverId,
        serverAName: serverA.name,
        serverBId: sb.serverId,
        serverBName: serverB.name,
        overlapCount: sql<number>`count(*)::int`,
      })
      .from(sa)
      .innerJoin(
        sb,
        and(eq(sb.memberId, sa.memberId), lt(sa.serverId, sb.serverId)),
      )
      .innerJoin(serverA, eq(serverA.id, sa.serverId))
      .innerJoin(serverB, eq(serverB.id, sb.serverId))
      .groupBy(sa.serverId, serverA.name, sb.serverId, serverB.name)
      .orderBy(desc(sql`count(*)`));
  }
}
