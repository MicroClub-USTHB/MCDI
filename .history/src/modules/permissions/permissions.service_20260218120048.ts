import { Injectable } from '@nestjs/common';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepository: PermissionsRepository) {}

  async checkPermission(dto: CheckPermissionDto) {
    // Step 3 will implement resolution logic
    return {
      allowed: false,
      source: 'none',
      ...dto,
    };
  }

  async upsertInheritanceRule(dto: UpsertInheritanceRuleDto) {
    // Step 5 will implement persistence logic
    return {
      message: 'not implemented yet',
      ...dto,
    };
  }

  async listInheritanceRules() {
    // Step 5 will implement listing logic
    return [];
  }
}
