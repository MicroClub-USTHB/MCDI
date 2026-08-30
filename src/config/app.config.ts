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
  statsCacheTtlMs: Number(process.env.STATS_CACHE_TTL_MS) || 5 * 60 * 1000,
  // A member counts as "active" if their server presence was reconfirmed by
  // sync (or, absent that, they joined) within this many days.
  memberActivityThresholdDays:
    Number(process.env.MEMBER_ACTIVITY_THRESHOLD_DAYS) || 30,
  projectAuthCacheTtlMs:
    Number(process.env.PROJECT_AUTH_CACHE_TTL_MS) || 30_000,
  projectAccessCacheTtlMs:
    Number(process.env.PROJECT_ACCESS_CACHE_TTL_MS) || 30_000,
  projectLastUsedWriteTtlMs:
    Number(process.env.PROJECT_LAST_USED_WRITE_TTL_MS) || 60_000,
  // Auth TTLs (seconds)
  authRequestTtlSec: Number(process.env.AUTH_REQUEST_TTL_SEC) || 600,
  oauthStateTtlSec: Number(process.env.OAUTH_STATE_TTL_SEC) || 600,
  callbackCodeTtlSec: Number(process.env.CALLBACK_CODE_TTL_SEC) || 120,
  sessionTtlSec: Number(process.env.SESSION_TTL_SEC) || 30 * 24 * 60 * 60, // 30 days
  // 64 hex chars; encrypts stored Discord webhook tokens at rest
  webhookEncryptionKey: process.env.WEBHOOK_ENCRYPTION_KEY || '',
  maxWebhooksPerProject: Number(process.env.MAX_WEBHOOKS_PER_PROJECT) || 10,
  // SSO — global browser session shared across projects
  ssoCookieName: process.env.SSO_COOKIE_NAME || 'mcdi_sso',
  ssoCookieDomain: process.env.SSO_COOKIE_DOMAIN || undefined,
  ssoTtlSec: Number(process.env.SSO_TTL_SEC) || 30 * 24 * 60 * 60, // 30 days
}));
