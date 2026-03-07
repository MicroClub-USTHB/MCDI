import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
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
    const corsOrigins = process.env.CORS_ORIGINS;
    if (corsOrigins) {
      corsOrigins.split(',').forEach((o) => allowedOrigins.push(o.trim()));
    }
  }

  app.use(cookieParser());

  app.enableCors({
    origin: nodeEnv === 'development' ? true : allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
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

  app.setGlobalPrefix(apiPrefix);
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', 'views'));
  app.setViewEngine('ejs');

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('MCDI API')
    .setDescription('Minecraft Club Discord Integration API Documentation')
    .setVersion('1.0')
    .addTag('Authentication', 'OAuth 2.0 authentication endpoints')
    .addTag('Members', 'Member queries — requires project API key')
    .addTag('Permissions', 'Permission checks and inheritance rules')
    .addTag('Servers', 'Server management — requires System Admin')
    .addTag('Admin Projects', 'Project management — requires System Admin')
    .addTag('Admin Members', 'Admin member management — requires System Admin')
    .addTag('Admin Sync', 'Sync management — requires System Admin')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'Token',
        name: 'Authorization',
        description: 'Enter your session token (from admin login or POST /auth/validate)',
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${apiPrefix}/docs`, app, document, {
    customSiteTitle: 'MCDI API Documentation',
    customfavIcon: 'https://nestjs.com/img/logo-small.svg',
    customCss: '.swagger-ui .topbar { display: none }',
  });

  await app.listen(port);
  console.log(
    `Application is running on: http://localhost:${port}/${apiPrefix}`,
  );
  console.log(
    `Swagger documentation available at: http://localhost:${port}/${apiPrefix}/docs`,
  );
}
void bootstrap();
