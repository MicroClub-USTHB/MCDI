import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RootOnly } from '../../common/decorators/admin-access.decorator';
import { AdminAccessGuard } from '../../common/guards/admin-access.guard';
import { extractClientInfo } from '../../common/utils/client-info.util';
import { AdminAccessGrantsService } from './admin-access-grants.service';
import { SetGrantsDto } from './dto/set-grants.dto';

type RequestWithMember = Request & { memberId: string };

/**
 * Who may do what in the admin API. Root admins only: this is not a catalog
 * resource, so it cannot be granted to anyone else.
 */
@ApiTags('Admin Access')
@ApiBearerAuth('session-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid admin session.' })
@ApiForbiddenResponse({ description: 'Root admin access required.' })
@Controller('admin/access')
@UseGuards(AdminAccessGuard)
@RootOnly()
export class AdminAccessController {
  constructor(private readonly grants: AdminAccessGrantsService) {}

  @Get('catalog')
  @ApiOperation({
    summary: 'List the admin resources and levels',
    description:
      'The resources a grant can name and the four levels, with descriptions.',
  })
  @ApiOkResponse({ description: 'Resources and levels.' })
  getCatalog() {
    return this.grants.getCatalog();
  }

  @Get('roles')
  @ApiOperation({
    summary: 'List main-server roles with their grants',
    description: 'Root roles are flagged and cannot be given grants.',
  })
  @ApiOkResponse({ description: 'Roles with their grants.' })
  listRoles() {
    return this.grants.listRoles();
  }

  @Get('overrides')
  @ApiOperation({
    summary: 'List the members that have overrides',
    description:
      'Every member with at least one override and their overrides, ordered by name. Not paginated: ' +
      "the list is bounded by the club's size. `root` marks a member whose overrides are inactive " +
      'because they currently hold a root role.',
  })
  @ApiOkResponse({ description: 'Members with their overrides.' })
  listMemberOverrides() {
    return this.grants.listMemberOverrides();
  }

  @Put('roles/:roleId')
  @ApiOperation({
    summary: "Replace a role's grants",
    description:
      'Replaces every grant of the role. Resources left out, or set to `none`, have no grant.',
  })
  @ApiOkResponse({ description: 'The grants now held by the role.' })
  @ApiBadRequestResponse({
    description: 'Unknown resource or level, or a root role.',
  })
  @ApiNotFoundResponse({ description: 'Role not found in the main server.' })
  setRoleGrants(
    @Param('roleId') roleId: string,
    @Body() dto: SetGrantsDto,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.setRoleGrants(
      req.memberId,
      roleId,
      dto.grants,
      extractClientInfo(req),
    );
  }

  @Get('members/:memberId')
  @ApiOperation({ summary: "Get a member's overrides" })
  @ApiOkResponse({ description: 'The overrides of the member.' })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  getMemberOverrides(@Param('memberId') memberId: string) {
    return this.grants.getMemberOverrides(memberId);
  }

  @Put('members/:memberId')
  @ApiOperation({
    summary: "Replace a member's overrides",
    description:
      'An override replaces what the roles grant for that resource, for this member only. `none` denies.',
  })
  @ApiOkResponse({ description: 'The overrides now held by the member.' })
  @ApiBadRequestResponse({
    description: 'Unknown resource or level, or a root member.',
  })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  setMemberOverrides(
    @Param('memberId') memberId: string,
    @Body() dto: SetGrantsDto,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.setMemberOverrides(
      req.memberId,
      memberId,
      dto.grants,
      extractClientInfo(req),
    );
  }

  @Delete('members/:memberId/:resource')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove one override',
    description:
      'The member falls back to what their roles grant for that resource.',
  })
  @ApiNoContentResponse({ description: 'Override removed.' })
  @ApiBadRequestResponse({ description: 'Unknown resource.' })
  @ApiNotFoundResponse({ description: 'Member or override not found.' })
  removeMemberOverride(
    @Param('memberId') memberId: string,
    @Param('resource') resource: string,
    @Req() req: RequestWithMember,
  ) {
    return this.grants.removeMemberOverride(
      req.memberId,
      memberId,
      resource,
      extractClientInfo(req),
    );
  }

  @Get('members/:memberId/effective')
  @ApiOperation({
    summary: "Explain a member's effective access",
    description:
      "The member's name, the resolved level per resource and where it comes from: root, an override, or the role that supplied it.",
  })
  @ApiOkResponse({ description: 'Effective access with sources.' })
  @ApiNotFoundResponse({ description: 'Member not found.' })
  getMemberEffective(@Param('memberId') memberId: string) {
    return this.grants.getMemberEffective(memberId);
  }
}
