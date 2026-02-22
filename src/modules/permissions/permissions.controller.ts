import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CheckPermissionDto } from './dto/check-permission.dto';
import { UpsertInheritanceRuleDto } from './dto/upsert-inheritance-rule.dto';
import { PermissionsService } from './permissions.service';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @Post('check')
  @ApiOperation({
    summary: 'Check user permission in a specific server context',
  })
  @ApiBody({ type: CheckPermissionDto })
  @ApiOkResponse({ description: 'Permission check result returned.' })
  checkPermission(@Body() dto: CheckPermissionDto) {
    return this.permissionsService.checkPermission(dto);
  }

  @Post('inheritance-rules')
  @UseGuards(SystemAdminGuard)
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
  @ApiOperation({ summary: 'List inheritance rules' })
  @ApiOkResponse({ description: 'Inheritance rules list returned.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  listInheritanceRules() {
    return this.permissionsService.listInheritanceRules();
  }
}
