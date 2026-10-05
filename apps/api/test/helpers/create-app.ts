import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppThrottlerGuard } from '../../src/common/guards/app-throttler.guard';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import { AppModule } from '../../src/app.module';
import { DatabaseInitService } from '../../src/database/database-init.service';
import { PostgresExceptionFilter } from '../../src/common/filters/drizzle.filter';

/**
 * Bootstrap a full NestJS application instance suitable for E2E tests.
 * Mirrors the setup in `src/main.ts` (global prefix, validation pipe, views).
 */
export async function createTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';
  process.env.MC_EXECUTIVE_ROLE_ID = '700000000000000001';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Disable rate limiting in E2E tests so tests don't trip over each other
    .overrideGuard(AppThrottlerGuard)
    .useValue({ canActivate: () => true })
    // E2E tests manage their own DB schema — skip auto-migration
    .overrideProvider(DatabaseInitService)
    .useValue({ onModuleInit: () => Promise.resolve() })
    .compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();

  // Base64 webhook avatars overflow Express's default 100kb JSON body limit
  app.useBodyParser('json', { limit: '512kb' });

  app.use(cookieParser());

  // Global validation — same config as production
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter, registered the way main.ts does it
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new PostgresExceptionFilter(httpAdapter));

  // API prefix matches production default
  app.setGlobalPrefix('api');

  // EJS view engine (needed for auth/login render tests)
  app.useStaticAssets(join(__dirname, '..', '..', 'src', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', '..', 'src', 'views'));
  app.setViewEngine('ejs');

  await app.init();
  return app;
}
