import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { extractSessionToken } from './common/utils/auth.util';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getHello(): string {
    return 'MCDI w l3alamiya';
  }

  @Get('admin')
  renderAdmin(
    @Req() req: Request,
    @Res() res: Response,
    @Query('error') error?: string,
  ) {
    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    const apiBasePath = `/${apiPrefix}`;

    return res.render('admin', {
      error,
      hasSessionToken: Boolean(extractSessionToken(req)),
      loginUrl: `${apiBasePath}/auth/admin/discord`,
      docsUrl: `${apiBasePath}/docs`,
      adminMeUrl: `${apiBasePath}/auth/admin/me`,
      createProjectUrl: `${apiBasePath}/admin/projects`,
      regenerateApiKeyBaseUrl: `${apiBasePath}/admin/projects`,
      updateRedirectUriBaseUrl: `${apiBasePath}/admin/projects`,
    });
  }

  @Get('admin/login')
  adminLogin(@Res() res: Response) {
    const apiPrefix = this.configService.get<string>('app.apiPrefix') || 'api';
    return res.redirect(`/${apiPrefix}/auth/admin/discord`);
  }

  @Get('health')
  getHealth() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }
}
