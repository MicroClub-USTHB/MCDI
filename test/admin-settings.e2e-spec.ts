/**
 * E2E: Admin Settings & Profile (/api/admin/settings/*, /api/admin/profile)
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips entire suite when DATABASE_URL is not set.
 *
 * Auth model: SystemAdminGuard (Bearer token).
 */
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
import { appSettings, members } from '../src/database/entities';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('/api/admin/settings & /api/admin/profile (e2e)', () => {
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

  it('rejects an unauthenticated request', async () => {
    await request(app.getHttpServer()).get('/api/admin/settings').expect(401);
  });

  describe('GET /api/admin/settings', () => {
    it('returns grouped settings with editable flags and masked secrets', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.cache.permissionTtlMs.editable).toBe(true);
      expect(res.body.cache.projectAuthTtlMs.editable).toBe(false);
      expect(res.body.rateLimit.maxWebhooksPerProject.editable).toBe(true);
      // Secret: only isSet, never a value
      expect(res.body.discord.token).toHaveProperty('isSet');
      expect(res.body.discord.token).not.toHaveProperty('value');
      expect(JSON.stringify(res.body)).not.toContain(
        process.env.WEBHOOK_ENCRYPTION_KEY || '__never__',
      );
    });
  });

  describe('PATCH /api/admin/settings', () => {
    it('persists an editable knob and reflects it immediately', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', auth())
        .send({
          cache: { permissionTtlMs: 900_000 },
          preferences: { memberActivityThresholdDays: 45 },
        })
        .expect(200);

      expect(res.body.cache.permissionTtlMs.value).toBe(900_000);
      expect(res.body.preferences.memberActivityThresholdDays.value).toBe(45);
      expect(res.body.meta.updatedBy).toBe(adminCtx.memberId);

      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 1));
      expect(row.permissionCacheTtlMs).toBe(900_000);
      expect(row.memberActivityThresholdDays).toBe(45);
      expect(row.statsCacheTtlMs).toBeNull();

      // A fresh GET still reports the override (read live, no restart)
      const after = await request(app.getHttpServer())
        .get('/api/admin/settings')
        .set('Authorization', auth())
        .expect(200);
      expect(after.body.cache.permissionTtlMs.value).toBe(900_000);
    });

    it('rejects a non-editable / unknown key with 400', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', auth())
        .send({ discord: { token: 'new-secret' } })
        .expect(400);

      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', auth())
        .send({ rateLimit: { maxWebhooksPerProject: 0 } })
        .expect(400);
    });
  });

  describe('POST /api/admin/settings/reset', () => {
    it('clears every stored override', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/settings')
        .set('Authorization', auth())
        .send({ cache: { statsTtlMs: 120_000 } })
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/admin/settings/reset')
        .set('Authorization', auth())
        .expect(200);

      expect(res.body.cache.statsTtlMs.value).toBe(300_000); // back to env default

      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 1));
      expect(row.statsCacheTtlMs).toBeNull();
    });
  });

  describe('/api/admin/profile', () => {
    it('GET returns the profile; PATCH writes only preferredName', async () => {
      const before = await request(app.getHttpServer())
        .get('/api/admin/profile')
        .set('Authorization', auth())
        .expect(200);
      expect(before.body.username).toBe('testadmin');
      expect(before.body.preferredName).toBeNull();

      const patched = await request(app.getHttpServer())
        .patch('/api/admin/profile')
        .set('Authorization', auth())
        .send({ preferredName: '  Exec  ' })
        .expect(200);
      expect(patched.body.preferredName).toBe('Exec'); // trimmed

      const [row] = await db
        .select()
        .from(members)
        .where(eq(members.id, adminCtx.memberId));
      expect(row.preferredName).toBe('Exec');
      expect(row.displayName).toBe('Test Admin'); // untouched

      // /auth/admin/me agrees
      const me = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', auth())
        .expect(200);
      expect(me.body.preferredName).toBe('Exec');

      // null clears it
      const cleared = await request(app.getHttpServer())
        .patch('/api/admin/profile')
        .set('Authorization', auth())
        .send({ preferredName: null })
        .expect(200);
      expect(cleared.body.preferredName).toBeNull();
    });

    it('rejects a Discord-owned field with 400', async () => {
      await request(app.getHttpServer())
        .patch('/api/admin/profile')
        .set('Authorization', auth())
        .send({ username: 'hacker' })
        .expect(400);
    });
  });
});
