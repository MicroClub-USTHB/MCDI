import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { HttpAdapterHost } from '@nestjs/core';
import { PostgresExceptionFilter } from './common/filters/drizzle.filter';
import {
  applyApiPrefix,
  createOpenApiDocument,
} from './openapi/create-document';

async function bootstrap() {
  // rawBody: inbound-webhook HMAC verification must sign the unparsed body —
  // key order and whitespace do not survive a JSON round trip.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  // Webhook avatars arrive as base64 JSON (up to 256KB decoded), which
  // overflows Express's default 100kb JSON body limit
  app.useBodyParser('json', { limit: '512kb' });
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

  applyApiPrefix(app, apiPrefix);
  app.useStaticAssets(join(__dirname, 'public'));
  app.useStaticAssets(join(__dirname, 'views', 'assets'), {
    prefix: '/assets',
  });
  app.setBaseViewsDir(join(__dirname, 'views'));
  app.setViewEngine('ejs');

  const document = createOpenApiDocument(
    app,
    process.env.BASE_URL || `http://localhost:${port}`,
  );

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
