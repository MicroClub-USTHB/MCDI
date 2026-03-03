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
        apiKey: expect.stringMatching(/^mcdi_pk_live_/),
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

      expect(res.body).toMatchObject({ id: projectId, name: 'Get By ID Project' });
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
        .post(`${BASE}/${projectId}/regenerate-key`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        apiKey: expect.stringMatching(/^mcdi_pk_live_/),
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
        .expect(200);

      await request(app.getHttpServer())
        .get(`${BASE}/${projectId}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });
});
