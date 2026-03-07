import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || process.env.APP_PORT || '3000', 10),
  apiPrefix: process.env.API_PREFIX || 'api',
  baseUrl:
    process.env.BASE_URL ||
    `http://localhost:${process.env.PORT || process.env.APP_PORT || '3000'}`,
  corsOrigins: process.env.CORS_ORIGINS,
  permissionCacheTtlMs:
    Number(process.env.PERMISSION_CACHE_TTL_MS) || 5 * 60 * 1000,
}));
