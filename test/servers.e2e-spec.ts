/**
 * E2E: Servers endpoints (/api/servers/*)
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
import { servers } from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/servers (e2e)', () => {
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
    // Re-seed admin context — bearerToken used in Authorization header
    adminCtx = await seedAdminContext(db);
  });

  const auth = () => `Bearer ${adminCtx.bearerToken}`;

  // ─── Authentication guard ─────────────────────────────────────

  it('rejects requests without Authorization header (401)', async () => {
    await request(app.getHttpServer()).get('/api/servers').expect(401);
  });

  it('rejects requests with invalid token (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/servers')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  // ─── POST /api/servers ────────────────────────────────────────

  describe('POST /api/servers', () => {
    it('registers a new server', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/servers')
        .set('Authorization', auth())
        .send({
          id: '111111111111111111',
          name: 'New Test Server',
          type: 'other',
        })
        .expect(201);

      expect(res.body).toMatchObject({
        id: '111111111111111111',
        name: 'New Test Server',
      });
    });
  });

  // ─── GET /api/servers ─────────────────────────────────────────

  describe('GET /api/servers', () => {
    it('returns the list of all servers', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/servers')
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      // seedAdminContext inserts one main server
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── GET /api/servers/:serverId ───────────────────────────────

  describe('GET /api/servers/:serverId', () => {
    it('returns the server when it exists', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        id: adminCtx.serverId,
        name: 'Test Main Server',
        isMain: true,
      });
    });

    it('returns 404 for unknown serverId', async () => {
      await request(app.getHttpServer())
        .get('/api/servers/000000000000000000')
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── PATCH /api/servers/:serverId ────────────────────────────

  describe('PATCH /api/servers/:serverId', () => {
    it('updates server name', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/servers/${adminCtx.serverId}`)
        .set('Authorization', auth())
        .send({ name: 'Updated Server Name' })
        .expect(200);

      expect(res.body).toMatchObject({ name: 'Updated Server Name' });
    });

    it('returns 404 for unknown serverId', async () => {
      await request(app.getHttpServer())
        .patch('/api/servers/000000000000000000')
        .set('Authorization', auth())
        .send({ name: 'Ghost' })
        .expect(404);
    });
  });

  // ─── PATCH /api/servers/:serverId/disable ────────────────────

  describe('PATCH /api/servers/:serverId/disable', () => {
    it('disables an active server', async () => {
      // Use a non-main server so the guard still works
      await db
        .insert(servers)
        .values({
          id: '222222222222222222',
          name: 'Secondary Server',
          type: 'other',
          isMain: false,
          isActive: true,
          syncedAt: new Date(),
        });

      const res = await request(app.getHttpServer())
        .patch('/api/servers/222222222222222222/disable')
        .set('Authorization', auth())
        .send({ reason: 'Maintenance' })
        .expect(200);

      expect(res.body).toMatchObject({ isActive: false });
    });
  });

  // ─── PATCH /api/servers/:serverId/enable ─────────────────────

  describe('PATCH /api/servers/:serverId/enable', () => {
    it('enables a disabled server', async () => {
      await db.insert(servers).values({
        id: '333333333333333333',
        name: 'Disabled Server',
        type: 'other',
        isMain: false,
        isActive: false,
        syncedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .patch('/api/servers/333333333333333333/enable')
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({ isActive: true });
    });
  });

  // ─── DELETE /api/servers/:serverId ────────────────────────────

  describe('DELETE /api/servers/:serverId', () => {
    it('deletes a non-main server', async () => {
      await db.insert(servers).values({
        id: '444444444444444444',
        name: 'Deletable Server',
        type: 'other',
        isMain: false,
        isActive: true,
        syncedAt: new Date(),
      });

      await request(app.getHttpServer())
        .delete('/api/servers/444444444444444444')
        .set('Authorization', auth())
        .expect(200);

      // Verify it's gone
      await request(app.getHttpServer())
        .get('/api/servers/444444444444444444')
        .set('Authorization', auth())
        .expect(404);
    });

    it('returns 404 when deleting unknown server', async () => {
      await request(app.getHttpServer())
        .delete('/api/servers/000000000000000099')
        .set('Authorization', auth())
        .expect(404);
    });
  });
});
