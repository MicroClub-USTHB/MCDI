import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  ADMIN_ACCESS_KEY,
  type AdminAccessRequirement,
} from '../decorators/admin-access.decorator';
import { AdminAccessGuard } from './admin-access.guard';

const SRC = join(__dirname, '..', '..');
const GUARDS_KEY = '__guards__';

/**
 * The classification from docs/superpowers/specs/2026-10-07-admin-permissions-design.md.
 * `resource:level`, `session` (own data) or `root` (grant management).
 */
const EXPECTED: Record<string, string> = {
  // servers
  'GET /servers': 'servers:read',
  'GET /servers/:serverId': 'servers:read',
  'POST /servers': 'servers:write',
  'PATCH /servers/:serverId': 'servers:write',
  'PATCH /servers/:serverId/disable': 'servers:write',
  'PATCH /servers/:serverId/enable': 'servers:write',
  'DELETE /servers/:serverId': 'servers:manage',
  // members
  'GET /admin/members': 'members:read',
  'GET /admin/members/cross-server': 'members:read',
  'GET /admin/members/export': 'members:read',
  'GET /admin/members/:discordId/servers': 'members:read',
  // channels and messages
  'GET /admin/servers/:serverId/channels': 'channels:read',
  'GET /admin/servers/:serverId/channels/:channelId': 'channels:read',
  'GET /admin/servers/:serverId/channels/:channelId/messages': 'messages:read',
  // roles
  'GET /permissions/inheritance-rules': 'roles:read',
  'POST /permissions/inheritance-rules': 'roles:write',
  'GET /permissions/admin/servers/:serverId/roles/:roleId/permissions':
    'roles:read',
  'POST /permissions/admin/servers/:serverId/roles/:roleId/permissions':
    'roles:write',
  'DELETE /permissions/admin/servers/:serverId/roles/:roleId/permissions/:permissionId':
    'roles:manage',
  'POST /permissions/admin/servers/:serverId/roles/:roleId/impact':
    'roles:read',
  // projects
  'GET /admin/projects': 'projects:read',
  'POST /admin/projects': 'projects:write',
  'GET /admin/projects/:id': 'projects:read',
  'PATCH /admin/projects/:id': 'projects:write',
  'DELETE /admin/projects/:id': 'projects:manage',
  'PATCH /admin/projects/:id/redirect-uri': 'projects:write',
  'PUT /admin/projects/:projectId/servers/:serverId': 'projects:write',
  'DELETE /admin/projects/:projectId/servers/:serverId': 'projects:manage',
  'GET /admin/projects/:projectId/servers': 'projects:read',
  'GET /admin/projects/servers/:serverId/projects': 'projects:read',
  'GET /admin/projects/access/matrix': 'projects:read',
  'GET /admin/projects/access/audit': 'projects:read',
  // project keys
  'GET /admin/projects/:id/api-key': 'project_keys:read',
  'POST /admin/projects/:id/regenerate-api-key': 'project_keys:write',
  'POST /admin/projects/:id/restore-key': 'project_keys:write',
  'DELETE /admin/projects/:id/key': 'project_keys:manage',
  // outbound webhooks
  'GET /admin/projects/:projectId/webhooks': 'webhooks:read',
  'GET /admin/webhooks/:webhookId': 'webhooks:read',
  'DELETE /admin/webhooks/:webhookId': 'webhooks:manage',
  // inbound webhooks
  'GET /admin/inbound-webhooks': 'inbound_webhooks:read',
  'POST /admin/inbound-webhooks': 'inbound_webhooks:write',
  'GET /admin/inbound-webhooks/settings': 'inbound_webhooks:read',
  'PUT /admin/inbound-webhooks/settings': 'inbound_webhooks:write',
  'POST /admin/inbound-webhooks/schema/preview': 'inbound_webhooks:read',
  'GET /admin/inbound-webhooks/:id': 'inbound_webhooks:read',
  'GET /admin/inbound-webhooks/:id/docs': 'inbound_webhooks:read',
  'PATCH /admin/inbound-webhooks/:id': 'inbound_webhooks:write',
  'GET /admin/inbound-webhooks/:id/roles': 'inbound_webhooks:read',
  'PUT /admin/inbound-webhooks/:id/roles': 'inbound_webhooks:write',
  'POST /admin/inbound-webhooks/:id/rotate-secret': 'inbound_webhooks:write',
  'DELETE /admin/inbound-webhooks/:id': 'inbound_webhooks:manage',
  // sync
  'POST /admin/sync/full': 'sync:write',
  'GET /admin/sync/status': 'sync:read',
  'GET /admin/sync/status/all': 'sync:read',
  'GET /admin/sync/logs': 'sync:read',
  'GET /admin/sync/logs/:syncLogId/changes': 'sync:read',
  // stats
  'GET /admin/stats/members': 'stats:read',
  'GET /admin/stats/members/growth': 'stats:read',
  'GET /admin/stats/roles': 'stats:read',
  'GET /admin/stats/servers': 'stats:read',
  'GET /admin/stats/cross-server': 'stats:read',
  'GET /admin/stats/export': 'stats:read',
  // audit and monitoring
  'GET /admin/audit/logs': 'audit:read',
  'GET /admin/audit/logs/export': 'audit:read',
  'GET /admin/monitoring/health': 'monitoring:read',
  'GET /admin/monitoring/usage': 'monitoring:read',
  'GET /admin/monitoring/auth-failures': 'monitoring:read',
  // settings
  'GET /admin/settings': 'settings:read',
  'PATCH /admin/settings': 'settings:write',
  'POST /admin/settings/reset': 'settings:manage',
  // own data: any valid admin session
  'GET /admin/profile': 'session',
  'PATCH /admin/profile': 'session',
  'GET /auth/admin/me': 'session',
  'POST /auth/admin/logout': 'session',
  // grant management: root only
  'GET /admin/access/catalog': 'root',
  'GET /admin/access/roles': 'root',
  'PUT /admin/access/roles/:roleId': 'root',
  'GET /admin/access/overrides': 'root',
  'GET /admin/access/members/:memberId': 'root',
  'PUT /admin/access/members/:memberId': 'root',
  'DELETE /admin/access/members/:memberId/:resource': 'root',
  'GET /admin/access/members/:memberId/effective': 'root',
};

function controllerFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return controllerFiles(full);
    return name.endsWith('.controller.ts') ? [full] : [];
  });
}

function describeRequirement(r: AdminAccessRequirement | undefined): string {
  if (!r) return 'MISSING';
  return r.kind === 'permission' ? `${r.resource}:${r.level}` : r.kind;
}

function joinPath(classPath: unknown, handlerPath: unknown): string {
  const parts = [classPath, handlerPath]
    .map((p) => (Array.isArray(p) ? p[0] : p))
    .map((p) => String(p ?? '').replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
  return `/${parts.join('/')}`;
}

/** Every handler whose class or method applies AdminAccessGuard, with its declared requirement. */
function discoverAdminRoutes(): Record<string, string> {
  const found: Record<string, string> = {};

  for (const file of controllerFiles(SRC)) {
    const exported = Object.values(require(file) as Record<string, unknown>);
    for (const cls of exported) {
      if (typeof cls !== 'function') continue;
      const classPath = Reflect.getMetadata(PATH_METADATA, cls);
      if (classPath === undefined) continue; // not a controller

      const classGuards: unknown[] = Reflect.getMetadata(GUARDS_KEY, cls) ?? [];
      const classRequirement = Reflect.getMetadata(ADMIN_ACCESS_KEY, cls) as
        AdminAccessRequirement | undefined;

      for (const name of Object.getOwnPropertyNames(cls.prototype)) {
        // Read the descriptor: `cls.prototype[name]` would run getters.
        const handler = Object.getOwnPropertyDescriptor(
          cls.prototype,
          name,
        )?.value;
        if (typeof handler !== 'function') continue;
        const handlerPath = Reflect.getMetadata(PATH_METADATA, handler);
        const method = Reflect.getMetadata(METHOD_METADATA, handler);
        if (handlerPath === undefined || method === undefined) continue;

        const guards: unknown[] = [
          ...classGuards,
          ...(Reflect.getMetadata(GUARDS_KEY, handler) ?? []),
        ];
        if (!guards.includes(AdminAccessGuard)) continue;

        const requirement =
          (Reflect.getMetadata(ADMIN_ACCESS_KEY, handler) as
            AdminAccessRequirement | undefined) ?? classRequirement;

        found[`${RequestMethod[method]} ${joinPath(classPath, handlerPath)}`] =
          describeRequirement(requirement);
      }
    }
  }
  return found;
}

describe('admin route classification', () => {
  const found = discoverAdminRoutes();

  it('finds the admin routes (guards against a vacuous pass)', () => {
    expect(Object.keys(found).length).toBeGreaterThan(70);
  });

  it('leaves no admin handler without a declared requirement', () => {
    const missing = Object.entries(found)
      .filter(([, requirement]) => requirement === 'MISSING')
      .map(([route]) => route);
    expect(missing).toEqual([]);
  });

  it('classifies every admin route exactly as the design says', () => {
    expect(found).toEqual(EXPECTED);
  });
});
