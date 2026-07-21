import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { HttpAdapterHost } from '@nestjs/core';
import { PostgresExceptionFilter } from './common/filters/drizzle.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableShutdownHooks();
  const configService = app.get(ConfigService);

  const port = configService.get<number>('app.port') || 3000;
  const apiPrefix = configService.get<string>('app.apiPrefix') || 'api';
  const nodeEnv = configService.get<string>('app.nodeEnv') || 'development';

  // CORS — allow Swagger UI, the configured redirect_uri origin, and any
  // localhost port used by platform clients during development.
  const allowedOrigins: (string | RegExp)[] = [
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];

  if (nodeEnv !== 'development') {
    // In production, load explicit allowed origins from env
    const corsOrigins = configService.get<string>('app.corsOrigins');
    if (corsOrigins) {
      corsOrigins.split(',').forEach((o) => allowedOrigins.push(o.trim()));
    }
  }

  app.use(cookieParser());

  app.enableCors({
    origin: nodeEnv === 'development' ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-API-Key'],
    credentials: true,
  });

  // Enable validation pipes globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Enable global exception filters
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PostgresExceptionFilter(httpAdapter));

  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'admin', method: RequestMethod.GET },
      { path: 'admin/login', method: RequestMethod.GET },
    ],
  });
  app.useStaticAssets(join(__dirname, 'public'));
  app.useStaticAssets(join(__dirname, 'views', 'assets'), {
    prefix: '/assets',
  });
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('ejs');

  // Swagger Configuration
  let swaggerServerUrl = process.env.BASE_URL || `http://localhost:${port}`;
  swaggerServerUrl = swaggerServerUrl.replace(/\/+$/, '');
  if (swaggerServerUrl.endsWith(`/${apiPrefix}`)) {
    swaggerServerUrl = swaggerServerUrl.slice(0, -`/${apiPrefix}`.length);
  }

  const config = new DocumentBuilder()
    .setTitle('MCDI API')
    .setDescription(
      'MicroClub Discord Identity API.\n\n' +
        '**MC Project endpoints** authenticate with `X-API-Key` header.\n\n' +
        '**Admin endpoints** authenticate with `Authorization: Bearer <token>`.\n\n' +
        'Scopes and operations are granted per project–server pair by a system administrator.',
    )
    .setVersion('1.0')
    .addTag(
      'Authentication',
      'Project-scoped login (`/auth/authorize`), backend-to-backend session ' +
        'API (`/auth/token`, `/auth/validate`, `/auth/logout`, ' +
        '`/auth/token/refresh`), and system-admin Discord OAuth ' +
        '(`/auth/admin/*`). Use `/auth/authorize` when you need to force a ' +
        'fresh Discord consent (step-up auth) or to stay on the pre-SSO ' +
        'flow.',
    )
    .addTag(
      'Authentication (SSO)',
      'SSO-aware entry point (`/auth/sso/authorize`) and the cookie-backed ' +
        'browser endpoints (`/auth/sso/session`, `/auth/sso/sessions`, ' +
        '`/auth/sso/logout`). After a member logs in once via Discord, ' +
        'every subsequent project login on the same browser skips the ' +
        'Discord screen. Recommended default for new integrations.',
    )
    .addTag('Members', 'Member lookups and cross-server views')
    .addTag(
      'Permissions',
      'Permission checking and inheritance rule management',
    )
    .addTag(
      'Projects',
      'MC Project registration and server access grants — system admin only',
    )
    .addTag(
      'Servers',
      'Discord server registration and lifecycle management — system admin only',
    )
    .addTag(
      'Sync',
      'Manual sync triggering and sync log inspection — system admin only',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        name: 'Authorization',
        description:
          'Enter your session token (from admin login or POST /auth/validate)',
        in: 'header',
      },
      'session-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'Project API key (prefix.secret format)',
      },
      'api-key',
    )
    .addServer(
      // The server URL should be the root ONLY.
      // NestJS paths include the apiPrefix already.
      process.env.BASE_URL || `http://localhost:${port}`,
      'API Server',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Patch all DTO schemas to forbid additional properties.
  // The server runs ValidationPipe with forbidNonWhitelisted:true, so any
  // unknown field returns 400.  Without this flag Schemathesis considers
  // those 400s invalid because the spec allows extra fields by default.
  if (document.components?.schemas) {
    type SchemaObject = Record<string, unknown> & {
      type?: string;
      properties?: Record<string, unknown>;
      additionalProperties?: boolean;
    };
    for (const schema of Object.values(document.components.schemas)) {
      const schemaObj = schema as SchemaObject;
      if (schemaObj.type === 'object' && schemaObj.properties) {
        schemaObj.additionalProperties = false;
      }
    }
  }

  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'MCDI API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(port, '0.0.0.0');
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `Swagger documentation available at: http://localhost:${port}/${apiPrefix}/docs`,
  );
}
void bootstrap();
