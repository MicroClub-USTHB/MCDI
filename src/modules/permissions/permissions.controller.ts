import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CheckPermissionDto } from './dto/check-permission.dto';
import {
  CheckPermissionsBatchDto,
  CheckMode,
} from './dto/check-permissions-batch.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { PermissionsService } from './permissions.service';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ─── Permission Checking API (project-scoped) ──────────────────────

  @Post('check')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Check a single permission for a user in a server context',
  })
  @ApiBody({ type: CheckPermissionDto })
  @ApiOkResponse({ description: 'Permission check result returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  checkPermission(@Body() dto: CheckPermissionDto) {
    return this.permissionsService.checkPermission(dto);
  }

  @Post('check-batch')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Check multiple permissions (ALL must match, or ANY must match)',
  })
  @ApiBody({ type: CheckPermissionsBatchDto })
  @ApiOkResponse({ description: 'Batch permission check result returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  async checkPermissionBatch(@Body() dto: CheckPermissionsBatchDto) {
    if (dto.mode === CheckMode.ALL) {
      return this.permissionsService.hasAllPermissions(
        dto.serverId,
        dto.discordId,
        dto.permissions,
      );
    }

    return this.permissionsService.hasAnyPermission(
      dto.serverId,
      dto.discordId,
      dto.permissions,
    );
  }

  @Get(':serverId/:discordId')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get the full resolved permission set for a user in a server',
  })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiParam({ name: 'discordId', description: 'Discord member ID' })
  @ApiOkResponse({ description: 'Full permission set returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  getMemberPermissions(
    @Param('serverId') serverId: string,
    @Param('discordId') discordId: string,
  ) {
    return this.permissionsService.getMemberPermissions(serverId, discordId);
  }

  // ─── Admin-only endpoints ──────────────────────────────────────────

  @Post('inheritance-rules')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Create or update an inheritance rule' })
  @ApiBody({ type: UpsertInheritanceRuleDto })
  @ApiOkResponse({ description: 'Inheritance rule upsert result returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  upsertInheritanceRule(@Body() dto: UpsertInheritanceRuleDto) {
    return this.permissionsService.upsertInheritanceRule(dto);
  }

  @Get('inheritance-rules')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List inheritance rules' })
  @ApiOkResponse({ description: 'Inheritance rules list returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listInheritanceRules() {
    return this.permissionsService.listInheritanceRules();
  }
}
