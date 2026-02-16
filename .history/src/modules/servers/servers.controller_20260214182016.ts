import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';
import { Delete } from '@nestjs/common';
import { ApiNotFoundResponse } from '@nestjs/swagger';
import { DisableServerDto } from './dto/disable-server.dto';

@ApiTags('Servers')
@UseGuards(SystemAdminGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @ApiOperation({ summary: 'Register or upsert a server by guild ID' })
  @ApiBody({ type: CreateServerDto })
  @ApiOkResponse({ description: 'Server registered successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  register(@Body() dto: CreateServerDto) {
    return this.serversService.registerServer(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all servers with health data' })
  @ApiOkResponse({ description: 'Servers retrieved successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  list() {
    return this.serversService.listServers();
  }

  @Patch(':serverId')
  @ApiOperation({ summary: 'Update server settings/state' })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiBody({ type: UpdateServerDto })
  @ApiOkResponse({ description: 'Server updated successfully.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  update(@Param('serverId') serverId: string, @Body() dto: UpdateServerDto) {
    return this.serversService.updateServer(serverId, dto);
  }

  @Get(':serverId')
  @ApiOperation({ summary: 'Get a single server by ID' })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiOkResponse({ description: 'Server retrieved successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  findOne(@Param('serverId') serverId: string) {
    return this.serversService.getServerById(serverId);
  }

  @Delete(':serverId')
  @ApiOperation({ summary: 'Delete a server by ID' })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiOkResponse({ description: 'Server deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  @ApiUnauthorizedResponse({ description: 'Authentication required.' })
  @ApiForbiddenResponse({ description: 'System Admin access required.' })
  remove(@Param('serverId') serverId: string) {
    return this.serversService.deleteServer(serverId);
  }

  @Patch(':serverId/disable')
  @ApiOperation({ summary: 'Disable server' })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiBody({ type: DisableServerDto })
  @ApiOkResponse({ description: 'Server disabled successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  disable(
  @Param('serverId') serverId: string,
  @Body() dto: DisableServerDto,
  ) {
    return this.serversService.disableServer(serverId, dto);
  }

  @Patch(':serverId/enable')
  @ApiOperation({ summary: 'Enable server' })
  @ApiParam({ name: 'serverId', description: 'Server (guild) ID' })
  @ApiOkResponse({ description: 'Server enabled successfully.' })
  @ApiNotFoundResponse({ description: 'Server not found.' })
  enable(@Param('serverId') serverId: string) {
    return this.serversService.enableServer(serverId);
  }

    
}
