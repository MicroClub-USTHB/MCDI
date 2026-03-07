import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiSecurity,
  getSchemaPath,
  ApiExtraModels,
} from '@nestjs/swagger';
import { MemberService } from './member.service';
import { GetMembersQueryDto } from './dto/get-members-query.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import {
  MemberResponseDto,
  MemberSearchResponseDto,
} from './dto/member-response.dto';
import { RequireProjectOperation } from '../../common/decorators/require-project-operation.decorator';
import { PermissionsService } from '../permissions/permissions.service';

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

@ApiTags('Members')
@ApiSecurity('api-key')
@ApiExtraModels(MemberSearchResponseDto)
@RequireProjectOperation('READ')
@Controller('servers/:serverId/members')
@UseGuards(ApiKeyGuard)
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get(':discordId')
  @RequireScope('read_members')
  @ApiOperation({
    summary: 'Get a single member by Discord ID',
    description:
      'Returns detailed profile of a member including all roles in the specified server',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'discordId',
    description: 'Discord user ID',
    example: '876543210987654321',
  })
  @ApiResponse({
    status: 200,
    description: 'Member found',
    type: MemberResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid Discord ID format' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key' })
  @ApiResponse({
    status: 403,
    description: 'Project does not have access to this server',
  })
  @ApiResponse({ status: 404, description: 'Member not found in this server' })
  async getMember(
    @Param('serverId') serverId: string,
    @Param('discordId') discordId: string,
  ): Promise<MemberResponseDto> {
    return await this.memberService.getMember(serverId, discordId);
  }

  @Get()
  @RequireScope('read_members')
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Search members',
    description: 'Search members by name, filter by role, with pagination.',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of matching members',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(MemberSearchResponseDto) },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 150 },
            pages: { type: 'number', example: 8 },
            hasNext: { type: 'boolean', example: true },
            hasPrev: { type: 'boolean', example: false },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key' })
  @ApiResponse({
    status: 403,
    description: 'Project does not have access to this server',
  })
  async searchMembers(
    @Param('serverId') serverId: string,
    @Query() queryDto: GetMembersQueryDto,
  ): Promise<{ data: MemberSearchResponseDto[]; pagination: PaginationMeta }> {
    return await this.memberService.searchMembers(serverId, queryDto);
  }

  @Get(':discordId/permissions')
  @RequireScope('read_members')
  @ApiOperation({
    summary: 'Get all effective permissions of a member in a server',
  })
  @ApiParam({
    name: 'serverId',
    description: 'Discord server ID',
    example: '123456789012345678',
  })
  @ApiParam({
    name: 'discordId',
    description: 'Discord user ID',
    example: '876543210987654321',
  })
  @ApiResponse({
    status: 200,
    description: 'Effective permissions returned',
    schema: {
      type: 'object',
      properties: {
        discordId: { type: 'string' },
        serverId: { type: 'string' },
        permissions: {
          type: 'array',
          items: { type: 'string' },
          example: ['SYSTEM_ADMIN', 'READ_MEMBERS'],
        },
        sources: {
          type: 'object',
          properties: {
            global: { type: 'array', items: { type: 'string' } },
            server: { type: 'array', items: { type: 'string' } },
            inherited: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid Discord ID format' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key' })
  @ApiResponse({
    status: 403,
    description: 'Project does not have access to this server',
  })
  async getMemberPermissions(
    @Param('serverId') serverId: string,
    @Param('discordId') discordId: string,
  ) {
    return this.permissionsService.getMemberPermissions(serverId, discordId);
  }
}
