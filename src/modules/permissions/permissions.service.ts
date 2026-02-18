import { BadRequestException, Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async checkPermission(dto: CheckPermissionDto) {
    const memberId = dto.discordId?.trim();
    const serverId = dto.serverId?.trim();
    const permissionName = dto.permission?.trim();

    if (!memberId || !serverId || !permissionName) {
      throw new BadRequestException(
        'discordId, serverId and permission are required',
      );
    }

    const permissionId =
      await this.permissionsRepository.findPermissionIdByName(permissionName);

    if (!permissionId) {
      return { allowed: false, source: 'none' as const };
    }

    const hasGlobal = await this.permissionsRepository.hasGlobalPermission(
      memberId,
      permissionId,
    );
    if (hasGlobal) {
      return { allowed: true, source: 'global' as const };
    }

    const hasServer = await this.permissionsRepository.hasServerPermission(
      memberId,
      serverId,
      permissionId,
    );
    if (hasServer) {
      return { allowed: true, source: 'server' as const };
    }
    const hasInherited = await this.permissionsRepository.hasInheritedPermission(
        memberId,
        serverId,
        permissionId,
    );
    if (hasInherited) {
        return { allowed: true, source: 'inherited' as const };
    }


    return { allowed: false, source: 'none' as const };
  }

  async upsertInheritanceRule(dto: UpsertInheritanceRuleDto) {
    return {
      message: 'not implemented yet',
      ...dto,
    };
  }

  async listInheritanceRules() {
    return [];
  }
}
