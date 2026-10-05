import { INestApplication, RequestMethod } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/**
 * Everything is under `/api` except the legacy admin pages, so that the routes the app
 * serves and the paths in the OpenAPI document stay the same thing.
 */
export function applyApiPrefix(app: INestApplication, apiPrefix: string): void {
  app.setGlobalPrefix(apiPrefix, {
    exclude: [
      { path: 'admin', method: RequestMethod.GET },
      { path: 'admin/login', method: RequestMethod.GET },
    ],
  });
}

/**
 * The OpenAPI document for the running API. `main.ts` serves it at `/api/docs-json` and the
 * export script writes it to `openapi.json`, so both go through this one function.
 *
 * `serverUrl` is the root only: the paths in the document already include the API prefix.
 */
export function createOpenApiDocument(
  app: INestApplication,
  serverUrl: string,
): OpenAPIObject {
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
      'Channels',
      'Discord channel listing, message history, and message sending — project API key',
    )
    .addTag(
      'Webhooks',
      'Discord webhook creation and management, authenticated with a project API key',
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
    .addServer(serverUrl, 'API Server')
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

  return document;
}
