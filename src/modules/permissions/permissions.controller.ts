import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { ListInheritanceRulesDto } from './dto/list-inheritance-rules.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { ImpactPreviewDto } from './dto/impact-preview.dto';
import { RolePermissionsResponseDto } from './dto/role-permissions-response.dto';
import { ImpactPreviewResponseDto } from './dto/impact-preview-response.dto';
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
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  @ApiOperation({
    summary: 'List inheritance rules',
    description: 'Returns all configured role inheritance rules.',
  })
  @ApiQuery({
    name: 'sourceRoleId',
    required: false,
    type: String,
    description: 'Filter by source role ID.',
  })
  @ApiQuery({
    name: 'enabled',
    required: false,
    type: Boolean,
    description: 'Filter by enabled status.',
  })
  @ApiQuery({
    name: 'targetScope',
    required: false,
    enum: ['all', 'selected'],
    description: 'Filter by target scope type.',
  })
  @ApiQuery({
    name: 'serverId',
    required: false,
    type: String,
    description:
      'Filter rules that apply to this server (scope=all always matches; scope=selected matches when this server is among targetServerIds).',
  })
  @ApiOkResponse({ description: 'Inheritance rules list returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid parameter format.' })
  listInheritanceRules(@Query() query: ListInheritanceRulesDto) {
    return this.permissionsService.listInheritanceRules(query);
  }

  // ─── Role-Permission Management API ────────────────────────────────

  @Get('admin/servers/:serverId/roles/:roleId/permissions')
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Get all permissions assigned to a role',
    description:
      'Returns the list of permissions currently assigned to a specific role in a server.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord guild snowflake ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Discord role snowflake ID',
    example: '987654321098765432',
  })
  @ApiOkResponse({
    description: 'Role permissions list returned.',
    type: RolePermissionsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid path parameter format.' })
  getRolePermissions(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
  ): Promise<RolePermissionsResponseDto> {
    return this.permissionsService.getRolePermissions(serverId, roleId);
  }

  @Post('admin/servers/:serverId/roles/:roleId/permissions')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Add permissions to a role',
    description:
      'Assigns one or more permissions to a role. ' +
      'Cache is invalidated immediately after the change.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord guild snowflake ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Discord role snowflake ID',
    example: '987654321098765432',
  })
  @ApiBody({ type: AssignPermissionsDto })
  @ApiOkResponse({
    description: 'Updated role permissions list returned.',
    type: RolePermissionsResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  assignPermissionsToRole(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @Body() dto: AssignPermissionsDto,
  ): Promise<RolePermissionsResponseDto> {
    return this.permissionsService.assignPermissionsToRole(
      serverId,
      roleId,
      dto,
    );
  }

  @Delete('admin/servers/:serverId/roles/:roleId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Remove a permission from a role',
    description:
      'Removes a single permission from a role. ' +
      'Executive roles (global or highest-ranking) are protected from modification. ' +
      'Cache is invalidated immediately after the change.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord guild snowflake ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Discord role snowflake ID',
    example: '987654321098765432',
  })
  @ApiParam({
    name: 'permissionId',
    description: 'Permission ID to remove',
    example: 1,
  })
  @ApiOkResponse({ description: 'Permission removed successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({
    description:
      'System Admin access required, or role is protected from modification.',
  })
  @ApiBadRequestResponse({ description: 'Invalid path parameter format.' })
  async removePermissionFromRole(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ): Promise<void> {
    await this.permissionsService.removePermissionFromRole(
      serverId,
      roleId,
      parseInt(permissionId, 10),
    );
  }

  @Post('admin/servers/:serverId/roles/:roleId/impact')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SystemAdminGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Preview impact of a permission change on a role',
    description:
      'Read-only endpoint that returns how many members would be affected ' +
      'by adding or removing permissions from a role. Does not modify any data.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord guild snowflake ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'roleId',
    description: 'Discord role snowflake ID',
    example: '987654321098765432',
  })
  @ApiBody({ type: ImpactPreviewDto })
  @ApiOkResponse({
    description: 'Impact preview returned.',
    type: ImpactPreviewResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  @ApiBadRequestResponse({ description: 'Invalid request body.' })
  previewImpact(
    @Param('serverId') serverId: string,
    @Param('roleId') roleId: string,
    @Body() dto: ImpactPreviewDto,
  ): Promise<ImpactPreviewResponseDto> {
    return this.permissionsService.previewImpact(serverId, roleId, dto);
  }
}
