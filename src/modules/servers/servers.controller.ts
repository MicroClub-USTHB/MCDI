import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { SystemAdminGuard } from '../../common/guards/system-admin.guard';
import { DisableServerDto } from './dto/disable-server.dto';

@ApiTags('Servers')
@ApiBearerAuth('session-token')
@UseGuards(SystemAdminGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a server',
    description:
      'Registers a new Discord guild with MCDI (upsert by guild ID). ' +
      'Once registered, the server can be granted to projects and included in syncs.',
  })
  @ApiBody({ type: CreateServerDto })
  @ApiCreatedResponse({ description: 'Server registered successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  register(@Body() dto: CreateServerDto) {
    return this.serversService.registerServer(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List all servers',
    description: 'Returns all registered servers with their current sync health data.',
  })
  @ApiOkResponse({ description: 'Servers retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  list() {
    return this.serversService.listServers();
  }

  @Get(':serverId')
  @ApiOperation({
    summary: 'Get a server by ID',
    description: 'Returns a single server record by its Discord guild snowflake ID.',
  })
  @ApiParam({ name: 'serverId', description: 'Discord guild snowflake ID', example: '123456789012345678' })
  @ApiOkResponse({ description: 'Server retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  findOne(@Param('serverId') serverId: string) {
    return this.serversService.getServerById(serverId);
  }

  @Patch(':serverId')
  @ApiOperation({
    summary: 'Update server settings',
    description: 'Updates the server name or other mutable settings.',
  })
  @ApiParam({ name: 'serverId', description: 'Discord guild snowflake ID', example: '123456789012345678' })
  @ApiBody({ type: UpdateServerDto })
  @ApiOkResponse({ description: 'Server updated successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  update(@Param('serverId') serverId: string, @Body() dto: UpdateServerDto) {
    return this.serversService.updateServer(serverId, dto);
  }

  @Patch(':serverId/disable')
  @ApiOperation({
    summary: 'Disable a server',
    description:
      'Marks the server as inactive. Disabled servers are excluded from syncs and all API permission/member checks return 403.',
  })
  @ApiParam({ name: 'serverId', description: 'Discord guild snowflake ID', example: '123456789012345678' })
  @ApiBody({ type: DisableServerDto })
  @ApiOkResponse({ description: 'Server disabled successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  disable(@Param('serverId') serverId: string, @Body() dto: DisableServerDto) {
    return this.serversService.disableServer(serverId, dto);
  }

  @Patch(':serverId/enable')
  @ApiOperation({
    summary: 'Enable a server',
    description: 'Re-activates a previously disabled server.',
  })
  @ApiParam({ name: 'serverId', description: 'Discord guild snowflake ID', example: '123456789012345678' })
  @ApiOkResponse({ description: 'Server enabled successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  enable(@Param('serverId') serverId: string) {
    return this.serversService.enableServer(serverId);
  }

  @Delete(':serverId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a server',
    description:
      'Permanently removes a server and all associated data (members, roles, sync logs). This cannot be undone.',
  })
  @ApiParam({ name: 'serverId', description: 'Discord guild snowflake ID', example: '123456789012345678' })
  @ApiNoContentResponse({ description: 'Server deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System admin access required.' })
  remove(@Param('serverId') serverId: string) {
    return this.serversService.deleteServer(serverId);
  }
}

