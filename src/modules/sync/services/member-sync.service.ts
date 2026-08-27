import { Injectable, Logger } from '@nestjs/common';
import { Guild, GuildMember, User } from 'discord.js';
import { MemberRepository } from '../../members/member.repository';
import { SyncLogService } from './sync-log.service';
import { SyncChangeEntry } from '../sync-types';
import { members } from '../../../database/entities/member.entity';
import { withRetry } from '../sync-retry.util';
import { PermissionCacheService } from '../../permissions/permission-cache.service';

@Injectable()
export class MemberSyncService {
  private readonly logger = new Logger(MemberSyncService.name);

  constructor(
    private readonly memberRepository: MemberRepository,
    private readonly syncLogService: SyncLogService,
    private readonly permissionCache: PermissionCacheService,
  ) {}

  /**
   * Upsert a single guild member's profile, server membership, and role list.
   */
  async processMember(
    guild: Guild,
    guildMember: GuildMember,
    syncTime: Date,
  ): Promise<void> {
    const memberData: typeof members.$inferInsert = {
      id: guildMember.id,
      username: guildMember.user.username,
      globalName: guildMember.user.globalName ?? null,
      displayName: guildMember.nickname ?? null,
      avatar: guildMember.user.avatarURL(),
      email: null,
      isClubMember: false,
      joinedAt: guildMember.joinedAt ?? null,
      syncedAt: syncTime,
    };
    await withRetry(
      () => this.memberRepository.upsertMember(memberData),
      `upsertMember(${guildMember.id})`,
      this.logger,
    );

    await withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: guild.id,
          memberId: guildMember.id,
          joinedAt: guildMember.joinedAt ?? null,
          isActive: true,
          lastSyncedAt: syncTime,
        }),
      `upsertServerMembership(${guildMember.id})`,
      this.logger,
    );

    const roleIds = [...guildMember.roles.cache.keys()];
    await withRetry(
      () =>
        this.memberRepository.replaceMemberRoles(
          guild.id,
          guildMember.id,
          roleIds,
        ),
      `replaceMemberRoles(${guildMember.id})`,
      this.logger,
    );
  }

  /**
   * Bulk-sync all members in a guild. Called during runFullSync.
   * Returns counts and appends change entries to the shared buffer.
   */
  async syncAllMembers(
    guild: Guild,
    syncId: number,
    syncStart: Date,
    changeBuffer: SyncChangeEntry[],
  ): Promise<{
    membersSynced: number;
    rolesSynced: number;
    deactivatedCount: number;
  }> {
    let membersSynced = 0;
    let rolesSynced = 0;
    let lastId: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const fetchOptions: { limit: number; after?: string } = { limit: 1000 };
      if (lastId) fetchOptions.after = lastId;

      const fetched = await guild.members.fetch(fetchOptions);
      if (fetched.size === 0) break;

      for (const [, guildMember] of fetched) {
        await this.processMember(guild, guildMember, syncStart);
        membersSynced++;
        rolesSynced += guildMember.roles.cache.size;

        changeBuffer.push({
          syncLogId: syncId,
          serverId: guild.id,
          entityType: 'member',
          entityId: guildMember.id,
          action: 'updated',
          description: `Member synced: ${guildMember.user.username}`,
          details: JSON.stringify({
            username: guildMember.user.username,
            nickname: guildMember.nickname,
            roles: [...guildMember.roles.cache.keys()],
          }),
        });
      }

      lastId = fetched.last()?.id;
      hasMore = fetched.size === 1000;
    }

    const deactivatedCount = await this.memberRepository.markInactiveForServer(
      guild.id,
      syncStart,
    );
    await this.permissionCache.invalidateServer(guild.id);
    this.logger.log(
      `Deactivated ${deactivatedCount} members in server ${guild.id}`,
    );

    if (deactivatedCount > 0) {
      changeBuffer.push({
        syncLogId: syncId,
        serverId: guild.id,
        entityType: 'member',
        entityId: guild.id,
        action: 'deactivated',
        description: `${deactivatedCount} members marked inactive`,
      });
    }

    return { membersSynced, rolesSynced, deactivatedCount };
  }

  // ─── Real-time gateway event handlers ────────────────────────────────

  async handleMemberAdd(guildMember: GuildMember): Promise<void> {
    this.logger.debug(
      `Member added: ${guildMember.id} in ${guildMember.guild.id}`,
    );
    await this.processMember(guildMember.guild, guildMember, new Date());
    await this.permissionCache.invalidateMember(guildMember.id);
    await this.syncLogService.recordEventChange(
      guildMember.guild.id,
      'member',
      guildMember.id,
      'added',
      `Member joined: ${guildMember.user.username}`,
    );
  }

  async handleMemberRemove(guildMember: GuildMember): Promise<void> {
    this.logger.debug(
      `Member removed: ${guildMember.id} in ${guildMember.guild.id}`,
    );
    await withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: guildMember.guild.id,
          memberId: guildMember.id,
          joinedAt: guildMember.joinedAt ?? null,
          isActive: false,
          lastSyncedAt: new Date(),
        }),
      `handleMemberRemove upsertServerMembership(${guildMember.id})`,
      this.logger,
    );
    await withRetry(
      () =>
        this.memberRepository.recordMemberDeparture(
          guildMember.guild.id,
          guildMember.id,
        ),
      `handleMemberRemove recordMemberDeparture(${guildMember.id})`,
      this.logger,
    );
    await this.permissionCache.invalidateMember(guildMember.id);
    await this.syncLogService.recordEventChange(
      guildMember.guild.id,
      'member',
      guildMember.id,
      'removed',
      `Member left: ${guildMember.user.username}`,
    );
  }

  async handleMemberUpdate(
    oldMember: GuildMember,
    newMember: GuildMember,
  ): Promise<void> {
    this.logger.debug(
      `Member updated: ${newMember.id} in ${newMember.guild.id}`,
    );
    const syncTime = new Date();

    const profileChanged =
      oldMember.user.username !== newMember.user.username ||
      oldMember.user.globalName !== newMember.user.globalName ||
      oldMember.user.avatar !== newMember.user.avatar ||
      oldMember.nickname !== newMember.nickname;

    if (profileChanged) {
      await withRetry(
        () =>
          this.memberRepository.upsertMember({
            id: newMember.id,
            username: newMember.user.username,
            globalName: newMember.user.globalName ?? null,
            displayName: newMember.nickname ?? null,
            avatar: newMember.user.avatarURL(),
            email: null,
            isClubMember: false,
            joinedAt: newMember.joinedAt ?? null,
            syncedAt: syncTime,
          }),
        `handleMemberUpdate upsertMember(${newMember.id})`,
        this.logger,
      );
    }

    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;
    const rolesChanged =
      oldRoles.size !== newRoles.size ||
      !oldRoles.every((role) => newRoles.has(role.id));

    if (rolesChanged) {
      await withRetry(
        () =>
          this.memberRepository.replaceMemberRoles(
            newMember.guild.id,
            newMember.id,
            [...newRoles.keys()],
          ),
        `handleMemberUpdate replaceMemberRoles(${newMember.id})`,
        this.logger,
      );
    }

    await withRetry(
      () =>
        this.memberRepository.upsertServerMembership({
          serverId: newMember.guild.id,
          memberId: newMember.id,
          joinedAt: newMember.joinedAt ?? null,
          isActive: true,
          lastSyncedAt: syncTime,
        }),
      `handleMemberUpdate upsertServerMembership(${newMember.id})`,
      this.logger,
    );
    if (rolesChanged) {
      await this.permissionCache.invalidateMember(newMember.id);
    }

    const changes: string[] = [];
    if (oldMember.user.username !== newMember.user.username)
      changes.push(
        `username: ${oldMember.user.username} → ${newMember.user.username}`,
      );
    if (oldMember.nickname !== newMember.nickname)
      changes.push(
        `nickname: ${oldMember.nickname ?? '(none)'} → ${newMember.nickname ?? '(none)'}`,
      );
    if (rolesChanged) changes.push('roles changed');

    await this.syncLogService.recordEventChange(
      newMember.guild.id,
      'member',
      newMember.id,
      'updated',
      `Member updated: ${newMember.user.username}`,
      changes.length > 0 ? JSON.stringify({ changes }) : undefined,
    );
  }

  async handleUserUpdate(oldUser: User, newUser: User): Promise<void> {
    this.logger.debug(`User updated: ${newUser.id}`);
    await withRetry(
      () =>
        this.memberRepository.upsertMember({
          id: newUser.id,
          username: newUser.username,
          globalName: newUser.globalName ?? null,
          displayName: null,
          avatar: newUser.avatarURL(),
          email: null,
          isClubMember: false,
          joinedAt: null,
          syncedAt: new Date(),
        }),
      `handleUserUpdate upsertMember(${newUser.id})`,
      this.logger,
    );
  }
}
