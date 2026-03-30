import { registerAs } from '@nestjs/config';

export default registerAs('discord', () => ({
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  loginRetryDelayMs: Number(process.env.DISCORD_LOGIN_RETRY_DELAY_MS) || 30000,
  redirectUri: process.env.DISCORD_CALLBACK_URL,
  adminRedirectUri:
    process.env.DISCORD_ADMIN_CALLBACK_URL ||
    process.env.DISCORD_CALLBACK_URL?.replace(
      '/auth/discord/callback',
      '/auth/admin/discord/callback',
    ),
  /** The main MCDI Discord guild — used for admin Executive role verification */
  mainGuildId: process.env.MC_GUILD_ID,
  /** Where to redirect after a successful admin Discord OAuth callback */
  adminFrontendUrl:
    process.env.ADMIN_FRONTEND_URL ||
    `${process.env.BASE_URL || 'http://localhost:3000'}/admin`,
}));
