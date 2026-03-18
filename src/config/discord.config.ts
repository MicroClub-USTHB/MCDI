import { registerAs } from '@nestjs/config';

export default registerAs('discord', () => ({
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  redirectUri: process.env.DISCORD_CALLBACK_URL,
  adminRedirectUri:
    process.env.DISCORD_ADMIN_CALLBACK_URL ||
    process.env.DISCORD_CALLBACK_URL?.replace(
      '/auth/discord/callback',
      '/auth/admin/discord/callback',
    ),
}));
