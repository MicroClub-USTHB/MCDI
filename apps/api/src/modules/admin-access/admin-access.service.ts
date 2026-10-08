import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  resolveEffectiveAccess,
  type EffectiveAccess,
} from '../../common/permissions/resolve-access';
import {
  PermissionCacheService,
  type CachedAdminAccess,
} from '../permissions/permission-cache.service';
import { AdminAccessRepository } from './admin-access.repository';

/**
 * Answers "what may this member do in the admin API". Root comes from the env
 * roles; everything else from `admin_role_access` and `admin_member_access`.
 * Results are cached per member and cleared by the sync handlers, grant edits
 * and admin login.
 */
@Injectable()
export class AdminAccessService {
  private readonly logger = new Logger(AdminAccessService.name);
  private readonly rootRoleIds: string[];

  constructor(
    private readonly repository: AdminAccessRepository,
    private readonly cache: PermissionCacheService,
    configService: ConfigService,
  ) {
    this.rootRoleIds = [
      configService.get<string>('discord.executiveRoleId'),
      configService.get<string>('discord.devLeadRoleId'),
      configService.get<string>('discord.itLeadRoleId'),
    ].filter((id): id is string => Boolean(id));
  }

  isRootRole(roleId: string): boolean {
    return this.rootRoleIds.includes(roleId);
  }

  async getEffectiveAccess(memberId: string): Promise<CachedAdminAccess> {
    const cached = await this.cache.getAdminAccess(memberId);
    if (cached) return cached;

    const mainServerId = await this.repository.findMainServerId();
    if (!mainServerId) {
      // Fail closed. Not cached, so the answer changes as soon as a main server exists.
      this.logger.warn('No main server configured: admin access is denied');
      return { root: false, access: this.nothing() };
    }

    const roleIds = await this.repository.findMemberRoleIdsInServer(
      memberId,
      mainServerId,
    );
    const isRoot = roleIds.some((id) => this.isRootRole(id));

    const [roleGrants, overrides] = isRoot
      ? [[], []]
      : await Promise.all([
          this.repository.findGrantsForRoles(roleIds),
          this.repository.findMemberOverrides(memberId),
        ]);

    const value: CachedAdminAccess = {
      root: isRoot,
      access: resolveEffectiveAccess({ isRoot, roleGrants, overrides }),
    };
    await this.cache.setAdminAccess(memberId, mainServerId, value);
    return value;
  }

  async invalidateMember(memberId: string): Promise<void> {
    await this.cache.invalidateMember(memberId);
  }

  private nothing(): EffectiveAccess {
    return resolveEffectiveAccess({
      isRoot: false,
      roleGrants: [],
      overrides: [],
    });
  }
}
