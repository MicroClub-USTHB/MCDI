import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { SystemAdminGuard } from '../auth/guards/system-admin.guard';

@UseGuards(SystemAdminGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  register(@Body() dto: CreateServerDto) {
    return this.serversService.registerServer(dto);
  }

  @Get()
  list() {
    return this.serversService.listServers();
  }

  @Patch(':serverId')
  update(@Param('serverId') serverId: string, @Body() dto: UpdateServerDto) {
    return this.serversService.updateServer(serverId, dto);
  }
}
