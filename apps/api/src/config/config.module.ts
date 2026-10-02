import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import Joi from 'joi';
import appConfig from './app.config';
import databaseConfig from './database.config';
import discordConfig from './discord.config';
import redisConfig from './redis.config';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, discordConfig, redisConfig],
      envFilePath: ['.env'],
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        DATABASE_URL: Joi.string().required().messages({
          'any.required':
            'DATABASE_URL is required — set postgresql://user:pass@host:5432/db',
        }),
        DISCORD_TOKEN: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().messages({
            'any.required':
              'DISCORD_TOKEN is required in production — set your Discord bot token',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        DISCORD_CLIENT_ID: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().messages({
            'any.required':
              'DISCORD_CLIENT_ID is required in production — set from Discord Developer Portal',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        DISCORD_CLIENT_SECRET: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().messages({
            'any.required': 'DISCORD_CLIENT_SECRET is required in production',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        MC_GUILD_ID: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().messages({
            'any.required':
              'MC_GUILD_ID is required in production — set your main Discord server ID',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        MC_EXECUTIVE_ROLE_ID: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().required().messages({
            'any.required':
              'MC_EXECUTIVE_ROLE_ID is required in production — set your admin Discord role ID',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        DISCORD_CALLBACK_URL: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string().uri().required().messages({
            'any.required': 'DISCORD_CALLBACK_URL is required in production',
            'string.uri': 'DISCORD_CALLBACK_URL must be a valid URL',
          }),
          otherwise: Joi.string().allow('').default(''),
        }),
        WEBHOOK_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string()
            .pattern(/^[0-9a-fA-F]{64}$/)
            .required()
            .messages({
              'any.required':
                'WEBHOOK_ENCRYPTION_KEY is required in production. Generate with openssl rand -hex 32',
              'string.pattern.base':
                'WEBHOOK_ENCRYPTION_KEY must be 64 hex characters',
            }),
          otherwise: Joi.string()
            .pattern(/^[0-9a-fA-F]{64}$/)
            .allow('')
            .default('')
            .messages({
              'string.pattern.base':
                'WEBHOOK_ENCRYPTION_KEY must be 64 hex characters',
            }),
        }),
        INBOUND_WEBHOOK_ENCRYPTION_KEY: Joi.when('NODE_ENV', {
          is: 'production',
          then: Joi.string()
            .pattern(/^[0-9a-fA-F]{64}$/)
            .required()
            .messages({
              'any.required':
                'INBOUND_WEBHOOK_ENCRYPTION_KEY is required in production. Generate with openssl rand -hex 32',
              'string.pattern.base':
                'INBOUND_WEBHOOK_ENCRYPTION_KEY must be 64 hex characters',
            }),
          otherwise: Joi.string()
            .pattern(/^[0-9a-fA-F]{64}$/)
            .allow('')
            .default('')
            .messages({
              'string.pattern.base':
                'INBOUND_WEBHOOK_ENCRYPTION_KEY must be 64 hex characters',
            }),
        }),
        MAX_WEBHOOKS_PER_PROJECT: Joi.number().integer().min(1).default(10),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().port().default(6379),
        REDIS_PASSWORD: Joi.string().allow('').default(''),
      }),
    }),
  ],
})
export class ConfigModule {}
