/**
 * E2E: the database allows at most one main server (servers_single_main_idx).
 *
 * Requires a running PostgreSQL database (`DATABASE_URL`).
 * Skips the entire suite when DATABASE_URL is not set.
 */
import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';
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
import { ServersRepository } from '../src/modules/servers/servers.repository';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;

describeIf('single main server (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let adminCtx: AdminContext;

  const mainServerIds = async () =>
    (
      await db
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.isMain, true))
    )
      .map((r) => r.id)
      .sort();

  const addServer = (id: string) =>
    db
      .insert(servers)
      .values({ id, name: id, isMain: false, syncedAt: new Date() });

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

  it('rejects a second main server inserted with direct SQL', async () => {
    await expect(
      db.insert(servers).values({ id: 'second-main', name: 'x', isMain: true }),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
    expect(await mainServerIds()).toEqual([adminCtx.serverId]);
  });

  it('rejects flipping a second server to main with direct SQL', async () => {
    await addServer('other');
    await expect(
      db.update(servers).set({ isMain: true }).where(eq(servers.id, 'other')),
    ).rejects.toMatchObject({ cause: { code: '23505' } });
  });

  it('PATCH /api/servers/:id switches the main server and leaves exactly one', async () => {
    await addServer('other');

    await request(app.getHttpServer())
      .patch('/api/servers/other')
      .set('Authorization', `Bearer ${adminCtx.bearerToken}`)
      .send({ isMain: true })
      .expect(200);

    expect(await mainServerIds()).toEqual(['other']);
  });

  it('a concurrent switch to another server fails and leaves one main server', async () => {
    await addServer('winner');
    await addServer('loser');
    const repo = new ServersRepository(db as any);

    // Another transaction is switching the main server to "winner" and has not
    // committed yet.
    const pool = new Pool({ connectionString: DB_URL });
    const tx = await pool.connect();
    try {
      await tx.query('BEGIN');
      await tx.query('UPDATE servers SET is_main = false WHERE is_main');
      await tx.query("UPDATE servers SET is_main = true WHERE id = 'winner'");

      const loser = repo.updateByIdAsMain('loser', {}, new Date());
      const loserOutcome = loser.then(
        () => 'ok',
        (e: { cause?: { code?: string } }) => e.cause?.code,
      );
      await new Promise((r) => setTimeout(r, 200));
      await tx.query('COMMIT');

      expect(await loserOutcome).toBe('23505');
    } finally {
      tx.release();
      await pool.end();
    }

    expect(await mainServerIds()).toEqual(['winner']);
  });
});
