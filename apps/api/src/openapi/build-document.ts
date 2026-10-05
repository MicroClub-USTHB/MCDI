import type { OpenAPIObject } from '@nestjs/swagger';

import { applyApiPrefix, createOpenApiDocument } from './create-document';

/** Fixed, so the document is the same whoever builds it and wherever. */
const API_PREFIX = 'api';
const SERVER_URL = 'http://localhost:3000';

/**
 * Builds the API's OpenAPI document without starting the application.
 *
 * `NestFactory.create` resolves providers but does not run `onModuleInit`, so nothing connects to
 * the database, Redis or Discord. The values set here only satisfy the config validation, and
 * point at addresses that never answer.
 *
 * The document is only complete when the code was built by `nest build` (its Swagger plugin
 * reads descriptions and types from the code), which is how the export script runs it.
 */
export async function buildOpenApiDocument(): Promise<OpenAPIObject> {
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://openapi:openapi@127.0.0.1:1/openapi';
  process.env.REDIS_HOST = '127.0.0.1';
  process.env.REDIS_PORT = '1';

  // After the environment is set: the config module validates it when AppModule is loaded.
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../app.module');

  const app = await NestFactory.create(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    applyApiPrefix(app, API_PREFIX);
    return createOpenApiDocument(app, SERVER_URL);
  } finally {
    await app.close();
  }
}
