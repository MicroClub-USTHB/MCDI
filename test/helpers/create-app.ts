import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from '../../src/app.module';

/**
 * Bootstrap a full NestJS application instance suitable for E2E tests.
 * Mirrors the setup in `src/main.ts` (global prefix, validation pipe, views).
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();

  // Global validation — same config as production
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // API prefix matches production default
  app.setGlobalPrefix('api');

  // EJS view engine (needed for auth/login render tests)
  app.useStaticAssets(join(__dirname, '..', '..', 'src', 'public'));
  app.setBaseViewsDir(join(__dirname, '..', '..', 'src', 'views'));
  app.setViewEngine('ejs');

  await app.init();
  return app;
}
