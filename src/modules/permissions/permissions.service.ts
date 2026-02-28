import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { PermissionsRepository } from './permissions.repository';
import { PermissionCacheService } from './permission-cache.service';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly permissionCache: PermissionCacheService,
  ) { }

  async checkPermission(dto: CheckPermissionDto) {
    const memberId = dto.discordId?.trim();
    const serverId = dto.serverId?.trim();
    const permissionName = dto.permission?.trim().toUpperCase();

    if (!memberId || !serverId || !permissionName) {
      throw new BadRequestException(
        'discordId, serverId and permission are required',
      );
    }

    // ── Fast path: use cached permission set if available ──────────────
    const cached = this.permissionCache.get(memberId, serverId);
    if (cached) {
      const allPerms = cached.permissions;
      // ADMINISTRATOR in any source = full access
      if (allPerms.includes('ADMINISTRATOR')) {
        return { allowed: true, source: 'cached' as const };
      }
      if (allPerms.includes(permissionName)) {
        return { allowed: true, source: 'cached' as const };
      }
      return { allowed: false, source: 'cached' as const };
    }

    // ── Slow path: DB queries ──────────────────────────────────────────
    const reqPermId = await this.permissionsRepository.findPermissionIdByName(permissionName);
    const adminPermId = await this.permissionsRepository.findPermissionIdByName('ADMINISTRATOR');

    if (!reqPermId && !adminPermId) {
      return { allowed: false, source: 'none' as const };
    }

    // Attempt to bypass with ADMINISTRATOR privilege early
    if (adminPermId) {
      const isGlobalAdmin = await this.permissionsRepository.hasGlobalRolePermission(memberId, adminPermId);
      if (isGlobalAdmin) return { allowed: true, source: 'global' as const };

      const isServerAdmin = await this.permissionsRepository.hasServerPermission(memberId, serverId, adminPermId);
      if (isServerAdmin) return { allowed: true, source: 'server' as const };

      const isInheritAdmin = await this.permissionsRepository.hasInheritedPermission(memberId, serverId, adminPermId);
      if (isInheritAdmin) return { allowed: true, source: 'inherited' as const };
    }

    // Not an admin, check standard specifically requested permission
    if (!reqPermId) {
      return { allowed: false, source: 'none' as const };
    }

    const hasGlobal = await this.permissionsRepository.hasGlobalRolePermission(
      memberId,
      reqPermId,
    );
    if (hasGlobal) {
      return { allowed: true, source: 'global' as const };
    }

    const hasServer = await this.permissionsRepository.hasServerPermission(
      memberId,
      serverId,
      reqPermId,
    );
    if (hasServer) {
      return { allowed: true, source: 'server' as const };
    }

    const hasInherited = await this.permissionsRepository.hasInheritedPermission(
      memberId,
      serverId,
      reqPermId,
    );
    if (hasInherited) {
      return { allowed: true, source: 'inherited' as const };
    }

    return { allowed: false, source: 'none' as const };
  }

  async upsertInheritanceRule(dto: UpsertInheritanceRuleDto) {
    const sourceRoleId = dto.sourceRoleId?.trim();
    if (!sourceRoleId) {
      throw new BadRequestException('sourceRoleId is required');
    }

    const mainServerId = await this.permissionsRepository.getMainServerId();
    if (!mainServerId) {
      throw new BadRequestException('No main server configured');
    }

    const roleServerId =
      await this.permissionsRepository.getRoleServerId(sourceRoleId);
    if (!roleServerId) {
      throw new BadRequestException('sourceRoleId does not exist');
    }

    if (roleServerId !== mainServerId) {
      throw new BadRequestException(
        'sourceRoleId must belong to the configured main server',
      );
    }

    const enabled = dto.enabled ?? true;
    const targetScope = dto.targetScope;
    let targetServerIds: string[] = [];

    if (targetScope === 'selected') {
      targetServerIds = Array.from(
        new Set(
          (dto.targetServerIds ?? [])
            .map((id) => id.trim())
            .filter((id) => id.length > 0),
        ),
      );

      if (!targetServerIds.length) {
        throw new BadRequestException(
          'targetServerIds is required when targetScope is selected',
        );
      }

      const missingServerIds =
        await this.permissionsRepository.findMissingServerIds(targetServerIds);

      if (missingServerIds.length) {
        throw new BadRequestException(
          `Unknown targetServerIds: ${missingServerIds.join(', ')}`,
        );
      }
    }

    const rule = await this.permissionsRepository.upsertInheritanceRule({
      sourceRoleId,
      targetScope,
      enabled,
      targetServerIds,
      now: new Date(),
    });

    return { message: 'Inheritance rule saved', rule };
  }

  async listInheritanceRules() {
    return this.permissionsRepository.listInheritanceRules();
  }

  private normalizePermissionNames(names: string[]): string[] {
    return Array.from(
      new Set(
        names.map((n) => n.trim().toUpperCase()).filter((n) => n.length > 0),
      ),
    ).sort();
  }

  async getMemberPermissions(serverId: string, discordId: string) {
    const memberId = discordId?.trim();
    const normalizedServerId = serverId?.trim();

    if (!memberId || !normalizedServerId) {
      throw new BadRequestException('discordId and serverId are required');
    }

    // ── Cache hit ────────────────────────────────────────────────────────
    const cached = this.permissionCache.get(memberId, normalizedServerId);
    if (cached) {
      return {
        discordId: memberId,
        serverId: normalizedServerId,
        ...cached,
      };
    }

    // ── Cache miss: resolve from DB ──────────────────────────────────────
    const [globalPermissions, serverPermissions, inheritedPermissions] =
      await Promise.all([
        this.permissionsRepository.listGlobalPermissionNames(memberId),
        this.permissionsRepository.listServerPermissionNames(
          memberId,
          normalizedServerId,
        ),
        this.permissionsRepository.listInheritedPermissionNames(
          memberId,
          normalizedServerId,
        ),
      ]);

    const global = this.normalizePermissionNames(globalPermissions);
    const server = this.normalizePermissionNames(serverPermissions);
    const inherited = this.normalizePermissionNames(inheritedPermissions);

    const permissions = Array.from(
      new Set([...global, ...server, ...inherited]),
    ).sort();

    const result = {
      discordId: memberId,
      serverId: normalizedServerId,
      permissions,
      sources: { global, server, inherited },
    };

    // Populate cache for future calls
    this.permissionCache.set(memberId, normalizedServerId, {
      permissions,
      sources: { global, server, inherited },
    });

    return result;
  }
}
