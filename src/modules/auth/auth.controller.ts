import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { AuthService } from './auth.service';
import { ValidateSessionDto } from './dto/validate-session.dto';
import { LogoutDto } from './dto/logout.dto';
import { LogoutAllDto } from './dto/logout-all.dto';

type RequestWithProject = Request & { project?: { id: string } };

@ApiTags('Auth')
@ApiBearerAuth('api-key')
@UseGuards(ApiKeyGuard)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate a session token (project-scoped)' })
  validate(@Body() dto: ValidateSessionDto, @Req() req: RequestWithProject) {
    return this.authService.validate(dto.token, req.project!.id);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout a session token (project-scoped)' })
  logout(@Body() dto: LogoutDto, @Req() req: RequestWithProject) {
    return this.authService.logout(dto.token, req.project!.id);
  }

  @Post('logout-all')
  @ApiOperation({ summary: 'Logout all sessions for a member (project-scoped)' })
  logoutAll(@Body() dto: LogoutAllDto, @Req() req: RequestWithProject) {
    return this.authService.logoutAll(dto.memberId, req.project!.id);
  }
}
