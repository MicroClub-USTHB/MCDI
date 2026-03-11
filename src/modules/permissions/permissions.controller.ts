import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
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
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Check a single permission',
    description:
      'Resolves whether a Discord member holds a specific permission in a given server. ' +
      'Permissions are derived from their roles and any configured inheritance rules.',
  })
  @ApiBody({ type: CheckPermissionDto })
  @ApiOkResponse({ description: 'Permission check result returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  @ApiForbiddenResponse({
    description: 'Server is disabled or project has no access.',
  })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  checkPermission(@Body() dto: CheckPermissionDto) {
    return this.permissionsService.checkPermission(dto);
  }

  @Post('check-batch')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Check multiple permissions (batch)',
    description:
      'Checks a list of permissions for a member in one call. ' +
      'Set `mode` to `ALL` to require every permission, or `ANY` to pass if at least one matches.',
  })
  @ApiBody({ type: CheckPermissionsBatchDto })
  @ApiOkResponse({ description: 'Batch permission check result returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  @ApiForbiddenResponse({
    description: 'Server is disabled or project has no access.',
  })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
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
    summary: 'Get full resolved permissions for a member',
    description:
      'Returns every effective permission the member holds in the server, ' +
      'including permissions inherited via role hierarchy rules. ' +
      'Requires the `check_permissions` scope for this server.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord guild snowflake ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'discordId',
    description: 'Discord user snowflake ID',
    example: '876543210987654321',
  })
  @ApiOkResponse({ description: 'Full permission set returned.' })
  @ApiUnauthorizedResponse({ description: 'Valid API key required.' })
  @ApiForbiddenResponse({
    description: 'Server is disabled or project has no access.',
  })
  @ApiBadRequestResponse({ description: 'Invalid path parameter format.' })
  getMemberPermissions(
    @Param('serverId') serverId: string,
    @Param('discordId') discordId: string,
  ) {
    return this.permissionsService.getMemberPermissions(serverId, discordId);
  }

  // ─── Admin-only endpoints ──────────────────────────────────────────

  @Post('inheritance-rules')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Create or update an inheritance rule',
    description:
      'Upserts a permission inheritance rule that causes members holding a source role to ' +
      'also receive all permissions of a target role, optionally scoped to a specific server.',
  })
  @ApiBody({ type: UpsertInheritanceRuleDto })
  @ApiOkResponse({ description: 'Inheritance rule upsert result returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  upsertInheritanceRule(@Body() dto: UpsertInheritanceRuleDto) {
    return this.permissionsService.upsertInheritanceRule(dto);
  }

  @Get('inheritance-rules')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'List inheritance rules',
    description: 'Returns all configured role inheritance rules.',
  })
  @ApiOkResponse({ description: 'Inheritance rules list returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid parameter format.' })
  listInheritanceRules() {
    return this.permissionsService.listInheritanceRules();
  }
}
