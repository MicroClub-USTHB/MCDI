import { Controller, Get, Inject, Query, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { extractSessionToken } from './common/utils/auth.util';
import { DRIZZLE, DrizzleDB } from './database/database.module';
import { RedisService } from './common/redis/redis.service';
import { SkipGlobalThrottle } from './common/guards/app-throttler.guard';

@ApiExcludeController()
@Controller()
export class AppController {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly redis: RedisService,
  ) {}

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
  @SkipGlobalThrottle()
  async getHealth(@Res() res?: Response) {
    const [databaseUp, redisUp] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const status = databaseUp && redisUp ? 'ok' : 'degraded';
    const payload = {
      status,
      uptime: Math.floor(process.uptime()),
      database: databaseUp ? 'up' : 'down',
      redis: redisUp ? 'up' : 'down',
    };

    // Report unhealthy (503) when a core dependency is unavailable so that
    // orchestrators (dokploy/docker healthcheck) stop routing real traffic.
    if (res) {
      return res.status(status === 'ok' ? 200 : 503).json(payload);
    }
    return payload;
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return await this.redis.ping();
    } catch {
      return false;
    }
  }
}
