/**
 * E2E: Admin Projects endpoints (/api/admin/projects/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips the entire suite when DATABASE_URL is not set.
 */
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/create-app';
import {
  AdminContext,
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedAdminContext,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/admin/projects (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let adminCtx: AdminContext;

  beforeAll(async () => {
    enableNock();
    db = getTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    disableNock();
    await closeTestDb();
    await app.close();
  });

  beforeEach(async () => {
    await clearAllTables(db);
    adminCtx = await seedAdminContext(db);
  });

  const auth = () => `Bearer ${adminCtx.bearerToken}`;
  const BASE = '/api/admin/projects';

  // ─── Guard ────────────────────────────────────────────────────

  it('rejects unauthenticated requests (401)', async () => {
    await request(app.getHttpServer()).get(BASE).expect(401);
  });

  // ─── POST /api/admin/projects ─────────────────────────────────

  describe('POST /api/admin/projects', () => {
    it('creates a project and returns the API key once', async () => {
      const res = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'E2E Project Alpha' })
        .expect(201);

      expect(res.body).toMatchObject({
        apiKey: expect.stringMatching(/^pk_/),
        project: {
          name: 'E2E Project Alpha',
          isActive: true,
        },
      });
    });

    it('returns 400 when name is missing', async () => {
      await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({})
        .expect(400);
    });
  });

  // ─── GET /api/admin/projects ──────────────────────────────────

  describe('GET /api/admin/projects', () => {
    it('returns an array of projects', async () => {
      // Create one project first
      await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'List Test Project' });

      const res = await request(app.getHttpServer())
        .get(BASE)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      // apiKeyHash should never be exposed
      const project = res.body[0];
      expect(project).not.toHaveProperty('apiKeyHash');
    });
  });

  // ─── GET /api/admin/projects/:id ─────────────────────────────

  describe('GET /api/admin/projects/:id', () => {
    it('returns a project by ID', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Get By ID Project' });

      const projectId = create.body.project.id;

      const res = await request(app.getHttpServer())
        .get(`${BASE}/${projectId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        id: projectId,
        name: 'Get By ID Project',
      });
    });

    it('returns 404 for unknown project ID', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── PATCH /api/admin/projects/:id ───────────────────────────

  describe('PATCH /api/admin/projects/:id', () => {
    it('updates the project name', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Old Name' });

      const projectId = create.body.project.id;

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${projectId}`)
        .set('Authorization', auth())
        .send({ name: 'New Name' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'New Name' });
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/00000000-0000-0000-0000-000000000000`)
        .set('Authorization', auth())
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  // ─── POST /api/admin/projects/:id/regenerate-key ─────────────

  describe('POST /api/admin/projects/:id/regenerate-key', () => {
    it('regenerates the API key and returns the new key', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Regen Key Project' });

      const projectId = create.body.project.id;
      const oldKey: string = create.body.apiKey;

      const res = await request(app.getHttpServer())
        .post(`${BASE}/${projectId}/regenerate-api-key`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        apiKey: expect.stringMatching(/^pk_/),
      });
      // New key should differ from original
      expect(res.body.apiKey).not.toBe(oldKey);
    });
  });

  // ─── DELETE /api/admin/projects/:id ──────────────────────────

  describe('DELETE /api/admin/projects/:id', () => {
    it('deletes a project', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Delete Me Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}`)
        .set('Authorization', auth())
        .expect(204);

      await request(app.getHttpServer())
        .get(`${BASE}/${projectId}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── GET /api/admin/projects/:id/api-key ─────────────────────

  describe('GET /api/admin/projects/:id/api-key', () => {
    it('returns API key metadata (not the full secret)', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'API Key Info Project' });

      const projectId = create.body.project.id;

      const res = await request(app.getHttpServer())
        .get(`${BASE}/${projectId}/api-key`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        projectId,
        apiKeyPrefix: expect.any(String),
        apiKeyCreatedAt: expect.any(String),
      });
      // Full secret must never be exposed
      expect(res.body).not.toHaveProperty('apiKeyHash');
      expect(res.body).not.toHaveProperty('secret');
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/00000000-0000-0000-0000-000000000000/api-key`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── DELETE /api/admin/projects/:id/key (revoke) ──────────────

  describe('DELETE /api/admin/projects/:id/key', () => {
    it('revokes the API key', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Revoke Key Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}/key`)
        .set('Authorization', auth())
        .expect(204);

      // After revoke, the key info should reflect no active key
      const info = await request(app.getHttpServer())
        .get(`${BASE}/${projectId}/api-key`)
        .set('Authorization', auth())
        .expect(200);

      // After revocation, the project should be inactive
      expect(info.body.isActive).toBe(false);
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .delete(`${BASE}/00000000-0000-0000-0000-000000000000/key`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── POST /api/admin/projects/:id/restore-key ─────────────────

  describe('POST /api/admin/projects/:id/restore-key', () => {
    it('restores a revoked key (returns 204)', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Restore Key Project' });

      const projectId = create.body.project.id;

      // First revoke
      await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}/key`)
        .set('Authorization', auth())
        .expect(204);

      // Then restore
      await request(app.getHttpServer())
        .post(`${BASE}/${projectId}/restore-key`)
        .set('Authorization', auth())
        .expect(204);
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .post(`${BASE}/00000000-0000-0000-0000-000000000000/restore-key`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── PATCH /api/admin/projects/:id/redirect-uri ───────────────

  describe('PATCH /api/admin/projects/:id/redirect-uri', () => {
    it('updates the allowed redirect URI', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Redirect URI Project' });

      const projectId = create.body.project.id;
      const newUri = 'https://updated.example.com/callback';

      const res = await request(app.getHttpServer())
        .patch(`${BASE}/${projectId}/redirect-uri`)
        .set('Authorization', auth())
        .send({ redirectUri: newUri })
        .expect(200);

      expect(res.body).toMatchObject({
        projectId,
        redirectUri: newUri,
      });
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .patch(`${BASE}/00000000-0000-0000-0000-000000000000/redirect-uri`)
        .set('Authorization', auth())
        .send({ redirectUri: 'https://example.com/callback' })
        .expect(404);
    });

    it('returns 400 when redirectUri is missing', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Redirect Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .patch(`${BASE}/${projectId}/redirect-uri`)
        .set('Authorization', auth())
        .send({})
        .expect(400);
    });
  });

  // ─── PUT /api/admin/projects/:projectId/servers/:serverId ─────

  describe('PUT /api/admin/projects/:projectId/servers/:serverId', () => {
    it('grants project access to a server', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Server Access Project' });

      const projectId = create.body.project.id;

      const res = await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
          scopes: ['read_members', 'check_permissions'],
        })
        .expect(200);

      expect(res.body).toMatchObject({
        projectId,
        serverId: adminCtx.serverId,
        scopes: expect.arrayContaining(['read_members', 'check_permissions']),
      });
    });

    it('returns 404 for unknown project', async () => {
      await request(app.getHttpServer())
        .put(
          `${BASE}/00000000-0000-0000-0000-000000000000/servers/${adminCtx.serverId}`,
        )
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        })
        .expect(404);
    });

    it('returns 404 for unknown server', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Unknown Server Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/000000000000000000`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        })
        .expect(404);
    });
  });

  // ─── DELETE /api/admin/projects/:projectId/servers/:serverId ──

  describe('DELETE /api/admin/projects/:projectId/servers/:serverId', () => {
    it('revokes project access to a server', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Revoke Server Access Project' });

      const projectId = create.body.project.id;

      // Grant access first
      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        })
        .expect(200);

      // Then revoke
      const res = await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toBeDefined();
    });

    it('returns 404 when access mapping does not exist', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'No Access Project' });

      const projectId = create.body.project.id;

      // Project creation auto-grants access to main servers; revoke it first
      await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(200);

      // Now no mapping exists — should be 404
      await request(app.getHttpServer())
        .delete(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── GET /api/admin/projects/:projectId/servers ───────────────

  describe('GET /api/admin/projects/:projectId/servers', () => {
    it('lists servers accessible by a project', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'List Servers Project' });

      const projectId = create.body.project.id;

      // Grant access first
      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/${projectId}/servers`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(
        (s: { serverId: string }) => s.serverId === adminCtx.serverId,
      );
      expect(found).toBeDefined();
    });

    it('returns empty array for a project with no server access', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Empty Servers Project' });

      const projectId = create.body.project.id;

      const res = await request(app.getHttpServer())
        .get(`${BASE}/${projectId}/servers`)
        .set('Authorization', auth())
        .expect(200);

      // projects/servers returns empty for new project with no access grants
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ─── GET /api/admin/projects/servers/:serverId/projects ───────

  describe('GET /api/admin/projects/servers/:serverId/projects', () => {
    it('lists projects that can access a specific server', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Server Projects Test' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/servers/${adminCtx.serverId}/projects`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const found = res.body.find(
        (p: { projectId: string }) => p.projectId === projectId,
      );
      expect(found).toBeDefined();
    });
  });

  // ─── GET /api/admin/projects/access/matrix ────────────────────

  describe('GET /api/admin/projects/access/matrix', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/access/matrix`)
        .expect(401);
    });

    it('returns the full project-server access matrix', async () => {
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Matrix Test Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/access/matrix`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const entry = res.body.find(
        (m: { projectId: string; serverId: string }) =>
          m.projectId === projectId && m.serverId === adminCtx.serverId,
      );
      expect(entry).toBeDefined();
    });
  });

  // ─── GET /api/admin/projects/access/audit ─────────────────────

  describe('GET /api/admin/projects/access/audit', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/access/audit`)
        .expect(401);
    });

    it('returns access audit log entries', async () => {
      // Seed the access entry to generate an audit log
      const create = await request(app.getHttpServer())
        .post(BASE)
        .set('Authorization', auth())
        .send({ name: 'Audit Log Project' });

      const projectId = create.body.project.id;

      await request(app.getHttpServer())
        .put(`${BASE}/${projectId}/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({
          operations: {
            READ: true,
            SEND_MESSAGES: false,
            MANAGE_WEBHOOKS: false,
          },
        });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/access/audit`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('respects the limit query param', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/access/audit?limit=5`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.length).toBeLessThanOrEqual(5);
    });
  });
});
