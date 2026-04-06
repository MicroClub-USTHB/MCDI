import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ImpactPreviewDto } from './dto/impact-preview.dto';
import {
  ListInheritanceRulesFilters,
  PermissionsRepository,
} from './permissions.repository';
import { PermissionCacheService } from './permission-cache.service';
import {
  RolePermissionsResponseDto,
  PermissionItemDto,
} from './dto/role-permissions-response.dto';
import { ImpactPreviewResponseDto } from './dto/impact-preview-response.dto';

@Injectable()
export class PermissionsService {
  constructor(
    private readonly permissionsRepository: PermissionsRepository,
    private readonly permissionCache: PermissionCacheService,
  ) {}

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
    const reqPermId =
      await this.permissionsRepository.findPermissionIdByName(permissionName);
    const adminPermId =
      await this.permissionsRepository.findPermissionIdByName('ADMINISTRATOR');

    if (!reqPermId && !adminPermId) {
      return { allowed: false, source: 'none' as const };
    }

    // Attempt to bypass with ADMINISTRATOR privilege early
    if (adminPermId) {
      const isGlobalAdmin =
        await this.permissionsRepository.hasGlobalRolePermission(
          memberId,
          adminPermId,
        );
      if (isGlobalAdmin) return { allowed: true, source: 'global' as const };

      const isServerAdmin =
        await this.permissionsRepository.hasServerPermission(
          memberId,
          serverId,
          adminPermId,
        );
      if (isServerAdmin) return { allowed: true, source: 'server' as const };

      const isHierarchyAdmin =
        await this.permissionsRepository.hasHierarchyPermission(
          memberId,
          serverId,
          adminPermId,
        );
      if (isHierarchyAdmin)
        return { allowed: true, source: 'hierarchy' as const };

      const isInheritAdmin =
        await this.permissionsRepository.hasInheritedPermission(
          memberId,
          serverId,
          adminPermId,
        );
      if (isInheritAdmin)
        return { allowed: true, source: 'inherited' as const };
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

    // Check same-server vertical hierarchy (higher-rank roles inherit lower-rank permissions)
    const hasHierarchy =
      await this.permissionsRepository.hasHierarchyPermission(
        memberId,
        serverId,
        reqPermId,
      );
    if (hasHierarchy) {
      return { allowed: true, source: 'hierarchy' as const };
    }

    const hasInherited =
      await this.permissionsRepository.hasInheritedPermission(
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

  async listInheritanceRules(filters?: ListInheritanceRulesFilters) {
    return this.permissionsRepository.listInheritanceRules(filters);
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
    const [
      globalPermissions,
      serverPermissions,
      hierarchyPermissions,
      inheritedPermissions,
    ] = await Promise.all([
      this.permissionsRepository.listGlobalPermissionNames(memberId),
      this.permissionsRepository.listServerPermissionNames(
        memberId,
        normalizedServerId,
      ),
      this.permissionsRepository.listHierarchyPermissionNames(
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
    const hierarchy = this.normalizePermissionNames(hierarchyPermissions);
    const inherited = this.normalizePermissionNames(inheritedPermissions);

    const permissions = Array.from(
      new Set([...global, ...server, ...hierarchy, ...inherited]),
    ).sort();

    const result = {
      discordId: memberId,
      serverId: normalizedServerId,
      permissions,
      sources: { global, server, hierarchy, inherited },
    };

    // Populate cache for future calls
    this.permissionCache.set(memberId, normalizedServerId, {
      permissions,
      sources: { global, server, hierarchy, inherited },
    });

    return result;
  }

  async hasAllPermissions(
    serverId: string,
    discordId: string,
    requestedPermissions: string[],
  ) {
    const resolved = await this.getMemberPermissions(serverId, discordId);
    const allPerms = resolved.permissions;

    // ADMINISTRATOR = full access
    if (allPerms.includes('ADMINISTRATOR')) {
      return { allowed: true, missing: [] };
    }

    const normalized = requestedPermissions
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p.length > 0);

    const missing = normalized.filter((p) => !allPerms.includes(p));
    return { allowed: missing.length === 0, missing };
  }

  async hasAnyPermission(
    serverId: string,
    discordId: string,
    requestedPermissions: string[],
  ) {
    const resolved = await this.getMemberPermissions(serverId, discordId);
    const allPerms = resolved.permissions;

    // ADMINISTRATOR = full access
    if (allPerms.includes('ADMINISTRATOR')) {
      return {
        allowed: true,
        matched: requestedPermissions.map((p) => p.trim().toUpperCase()),
      };
    }

    const normalized = requestedPermissions
      .map((p) => p.trim().toUpperCase())
      .filter((p) => p.length > 0);

    const matched = normalized.filter((p) => allPerms.includes(p));
    return { allowed: matched.length > 0, matched };
  }

  async getRolePermissions(
    serverId: string,
    roleId: string,
  ): Promise<RolePermissionsResponseDto> {
    const normalizedServerId = serverId?.trim();
    const normalizedRoleId = roleId?.trim();

    if (!normalizedServerId || !normalizedRoleId) {
      throw new BadRequestException('serverId and roleId are required');
    }

    const role =
      await this.permissionsRepository.getRoleWithServer(normalizedRoleId);
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (role.serverId !== normalizedServerId) {
      throw new BadRequestException(
        'Role does not belong to the specified server',
      );
    }

    const permissions =
      await this.permissionsRepository.getPermissionsByRole(normalizedRoleId);

    return this.mapToRolePermissionsResponse(role, permissions);
  }

  async assignPermissionsToRole(
    serverId: string,
    roleId: string,
    dto: AssignPermissionsDto,
  ): Promise<RolePermissionsResponseDto> {
    const normalizedServerId = serverId?.trim();
    const normalizedRoleId = roleId?.trim();

    if (!normalizedServerId || !normalizedRoleId) {
      throw new BadRequestException('serverId and roleId are required');
    }

    if (!dto.permissionIds.length) {
      throw new BadRequestException('permissionIds cannot be empty');
    }

    const role =
      await this.permissionsRepository.getRoleWithServer(normalizedRoleId);
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (role.serverId !== normalizedServerId) {
      throw new BadRequestException(
        'Role does not belong to the specified server',
      );
    }

    const validPermissionIds =
      await this.permissionsRepository.findExistingPermissionIds(
        dto.permissionIds,
      );

    const invalidIds = dto.permissionIds.filter(
      (id) => !validPermissionIds.includes(id),
    );
    if (invalidIds.length > 0) {
      throw new BadRequestException(
        `Permission IDs not found: ${invalidIds.join(', ')}`,
      );
    }

    await this.permissionsRepository.addPermissionsToRole(
      normalizedRoleId,
      dto.permissionIds,
    );

    this.permissionCache.invalidateServer(normalizedServerId);

    const permissions =
      await this.permissionsRepository.getPermissionsByRole(normalizedRoleId);

    return this.mapToRolePermissionsResponse(role, permissions);
  }

  async removePermissionFromRole(
    serverId: string,
    roleId: string,
    permissionId: number,
  ): Promise<void> {
    const normalizedServerId = serverId?.trim();
    const normalizedRoleId = roleId?.trim();

    if (!normalizedServerId || !normalizedRoleId) {
      throw new BadRequestException('serverId and roleId are required');
    }

    const role =
      await this.permissionsRepository.getRoleWithServer(normalizedRoleId);
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (role.serverId !== normalizedServerId) {
      throw new BadRequestException(
        'Role does not belong to the specified server',
      );
    }

    this.assertExecutiveRoleProtection(
      role,
      await this.permissionsRepository.getMinHierarchyLevelInServer(
        normalizedServerId,
      ),
    );

    await this.permissionsRepository.removePermissionFromRole(
      normalizedRoleId,
      permissionId,
    );

    this.permissionCache.invalidateServer(normalizedServerId);
  }

  async previewImpact(
    serverId: string,
    roleId: string,
    dto: ImpactPreviewDto,
  ): Promise<ImpactPreviewResponseDto> {
    const normalizedServerId = serverId?.trim();
    const normalizedRoleId = roleId?.trim();

    if (!normalizedServerId || !normalizedRoleId) {
      throw new BadRequestException('serverId and roleId are required');
    }

    const role =
      await this.permissionsRepository.getRoleWithServer(normalizedRoleId);
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    if (role.serverId !== normalizedServerId) {
      throw new BadRequestException(
        'Role does not belong to the specified server',
      );
    }

    const memberIds =
      await this.permissionsRepository.getMembersByRole(normalizedRoleId);

    return {
      affectedMembers: memberIds.length,
      memberIds,
      roleHolders: memberIds.length,
    };
  }

  private assertExecutiveRoleProtection(
    role: {
      isGlobal: boolean;
      hierarchyLevel: number | null;
    },
    minHierarchyLevel: number | null,
  ): void {
    if (role.isGlobal) {
      throw new ForbiddenException(
        'Cannot modify permissions of a global role',
      );
    }

    if (
      role.hierarchyLevel !== null &&
      minHierarchyLevel !== null &&
      role.hierarchyLevel === minHierarchyLevel
    ) {
      throw new ForbiddenException(
        'Cannot modify permissions of the highest-ranking role in the server',
      );
    }
  }

  private mapToRolePermissionsResponse(
    role: { id: string; name: string; serverId: string },
    permissions: { id: number; key: string; description: string | null }[],
  ): RolePermissionsResponseDto {
    const response = new RolePermissionsResponseDto();
    response.roleId = role.id;
    response.roleName = role.name;
    response.serverId = role.serverId;
    response.permissions = permissions.map((p) => {
      const item = new PermissionItemDto();
      item.id = p.id;
      item.key = p.key;
      item.description = p.description ?? undefined;
      return item;
    });
    return response;
  }
}
