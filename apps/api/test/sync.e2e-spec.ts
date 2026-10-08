/**
 * E2E: Sync endpoints (/api/admin/sync/*)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips entire suite when DATABASE_URL is not set.
 *
 * Auth model: AdminAccessGuard (Bearer token), as a root admin.
 *
 * Note: `POST /admin/sync/full` queues a durable sync job.
 *   - The endpoint returns 202 immediately after creating the queued log entry.
 *   - In the test environment, Discord is not ready, so the queued job is not
 *     drained automatically.
 *   - Status / logs / changes are tested with directly seeded data.
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
import {
  serverSyncLogs,
  syncChangeDetails,
  servers,
} from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/admin/sync (e2e)', () => {
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
  const BASE = '/api/admin/sync';

  // ─── Authentication guard ─────────────────────────────────────

  it('returns 401 when no Bearer token is provided', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/full`)
      .send({})
      .expect(401);
  });

  it('returns 401 for an invalid Bearer token', async () => {
    await request(app.getHttpServer())
      .post(`${BASE}/full`)
      .set('Authorization', 'Bearer invalid-token')
      .send({})
      .expect(401);
  });

  // ─── POST /api/admin/sync/full ────────────────────────────────

  describe('POST /api/admin/sync/full', () => {
    it('returns 202 with syncId when triggered for a specific server', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/full`)
        .set('Authorization', auth())
        .send({ serverIds: [adminCtx.serverId] })
        .expect(202);

      expect(res.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            serverId: adminCtx.serverId,
            syncId: expect.any(Number),
          }),
        ]),
      });
    });

    it('returns 202 and triggers sync for all active servers when serverIds is omitted', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/full`)
        .set('Authorization', auth())
        .send({})
        .expect(202);

      expect(res.body).toMatchObject({
        results: expect.any(Array),
      });
    });

    it('returns conflict error when a sync is already in progress', async () => {
      // Seed an in-progress log directly
      await db.insert(serverSyncLogs).values({
        serverId: adminCtx.serverId,
        status: 'in_progress',
        syncType: 'manual',
        membersSynced: 0,
        rolesSynced: 0,
        startedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .post(`${BASE}/full`)
        .set('Authorization', auth())
        .send({ serverIds: [adminCtx.serverId] })
        .expect(202);

      // The triggerMultipleSyncs returns an error in results rather than throwing
      const serverResult = res.body.results.find(
        (r: { serverId: string }) => r.serverId === adminCtx.serverId,
      );
      expect(serverResult).toMatchObject({
        serverId: adminCtx.serverId,
        error: expect.stringContaining('progress'),
      });
    });

    it('returns error for an unknown serverId in the results array', async () => {
      const res = await request(app.getHttpServer())
        .post(`${BASE}/full`)
        .set('Authorization', auth())
        .send({ serverIds: ['000000000000000000'] })
        .expect(202);

      const serverResult = res.body.results.find(
        (r: { serverId: string }) => r.serverId === '000000000000000000',
      );
      expect(serverResult).toMatchObject({ error: expect.any(String) });
    });
  });

  // ─── GET /api/admin/sync/status ───────────────────────────────

  describe('GET /api/admin/sync/status', () => {
    beforeEach(async () => {
      await db.insert(serverSyncLogs).values({
        serverId: adminCtx.serverId,
        status: 'success',
        syncType: 'manual',
        membersSynced: 10,
        rolesSynced: 5,
        message: 'Completed successfully',
        startedAt: new Date(Date.now() - 5000),
        finishedAt: new Date(),
      });
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/status?serverId=${adminCtx.serverId}`)
        .expect(401);
    });

    it('returns latest sync status for a server', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/status?serverId=${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        serverId: adminCtx.serverId,
        status: 'success',
        membersSynced: 10,
        rolesSynced: 5,
      });
    });

    it('returns 404 when no sync log exists for a server', async () => {
      // Insert a secondary server with no logs
      await db.insert(servers).values({
        id: '666666666666666666',
        name: 'Unsynced Server',
        type: 'other',
        isMain: false,
        isActive: true,
        syncedAt: new Date(),
      });

      await request(app.getHttpServer())
        .get(`${BASE}/status?serverId=666666666666666666`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  // ─── GET /api/admin/sync/status/all ──────────────────────────

  describe('GET /api/admin/sync/status/all', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer()).get(`${BASE}/status/all`).expect(401);
    });

    it('returns array of sync statuses for all active servers', async () => {
      await db.insert(serverSyncLogs).values({
        serverId: adminCtx.serverId,
        status: 'success',
        syncType: 'full',
        membersSynced: 5,
        rolesSynced: 2,
        startedAt: new Date(Date.now() - 5000),
        finishedAt: new Date(),
      });

      const res = await request(app.getHttpServer())
        .get(`${BASE}/status/all`)
        .set('Authorization', auth())
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      const serverStatus = res.body.find(
        (s: { serverId: string }) => s.serverId === adminCtx.serverId,
      );
      expect(serverStatus).toMatchObject({
        serverId: adminCtx.serverId,
        status: 'success',
      });
    });
  });

  // ─── GET /api/admin/sync/logs ─────────────────────────────────

  describe('GET /api/admin/sync/logs', () => {
    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/logs?serverId=${adminCtx.serverId}`)
        .expect(401);
    });

    it('returns paginated sync logs for a server', async () => {
      await db.insert(serverSyncLogs).values([
        {
          serverId: adminCtx.serverId,
          status: 'success',
          syncType: 'manual',
          membersSynced: 3,
          rolesSynced: 1,
          startedAt: new Date(Date.now() - 10000),
          finishedAt: new Date(Date.now() - 5000),
        },
        {
          serverId: adminCtx.serverId,
          status: 'failure',
          syncType: 'manual',
          membersSynced: 0,
          rolesSynced: 0,
          message: 'Discord API error',
          startedAt: new Date(Date.now() - 3000),
          finishedAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get(`${BASE}/logs?serverId=${adminCtx.serverId}`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        logs: expect.any(Array),
        total: expect.any(Number),
      });
      expect(res.body.logs.length).toBeGreaterThanOrEqual(2);
    });

    it('respects limit and offset params', async () => {
      // Insert 3 logs
      for (let i = 0; i < 3; i++) {
        await db.insert(serverSyncLogs).values({
          serverId: adminCtx.serverId,
          status: 'success',
          syncType: 'manual',
          membersSynced: i,
          rolesSynced: 0,
          startedAt: new Date(Date.now() - (3 - i) * 1000),
          finishedAt: new Date(),
        });
      }

      const res = await request(app.getHttpServer())
        .get(`${BASE}/logs?serverId=${adminCtx.serverId}&limit=2&offset=0`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.logs.length).toBeLessThanOrEqual(2);
    });
  });

  // ─── GET /api/admin/sync/logs/:syncLogId/changes ──────────────

  describe('GET /api/admin/sync/logs/:syncLogId/changes', () => {
    let syncLogId: number;

    beforeEach(async () => {
      const [log] = await db
        .insert(serverSyncLogs)
        .values({
          serverId: adminCtx.serverId,
          status: 'success',
          syncType: 'manual',
          membersSynced: 2,
          rolesSynced: 0,
          startedAt: new Date(Date.now() - 3000),
          finishedAt: new Date(),
        })
        .returning({ id: serverSyncLogs.id });
      syncLogId = log.id;

      // Seed change details for the log
      await db.insert(syncChangeDetails).values([
        {
          syncLogId,
          serverId: adminCtx.serverId,
          entityType: 'member',
          entityId: '123456789012345678',
          action: 'added',
          description: 'Member joined server',
        },
        {
          syncLogId,
          serverId: adminCtx.serverId,
          entityType: 'member',
          entityId: '876543210987654321',
          action: 'removed',
          description: 'Member left server',
        },
      ]);
    });

    it('returns 401 without auth', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/logs/${syncLogId}/changes`)
        .expect(401);
    });

    it('returns granular change details for a sync log', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/logs/${syncLogId}/changes`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body).toMatchObject({
        changes: expect.any(Array),
        total: expect.any(Number),
      });
      expect(res.body.changes.length).toBe(2);
    });

    it('respects limit and offset query params', async () => {
      const res = await request(app.getHttpServer())
        .get(`${BASE}/logs/${syncLogId}/changes?limit=1&offset=0`)
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.changes.length).toBe(1);
    });

    it('returns 404 for an unknown syncLogId', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/logs/99999/changes`)
        .set('Authorization', auth())
        .expect(404);
    });

    it('returns 400 for a non-numeric syncLogId', async () => {
      await request(app.getHttpServer())
        .get(`${BASE}/logs/not-a-number/changes`)
        .set('Authorization', auth())
        .expect(400);
    });
  });
});
