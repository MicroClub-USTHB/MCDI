/**
 * E2E: POST /api/admin/inbound-webhooks/schema/preview
 *
 * Runs through the real app: global pipes, the admin guard and the routing,
 * which the unit tests stub. Skips when DATABASE_URL is not set.
 */
import { INestApplication } from '@nestjs/common';
import { count } from 'drizzle-orm';
import request from 'supertest';
import { auditLogs, inboundWebhooks } from '../src/database/entities';
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

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;
const URL = '/api/admin/inbound-webhooks/schema/preview';

const schema = {
  version: 1,
  steps: [
    {
      key: 'identity',
      fields: [{ key: 'firstname', type: 'string', required: true }],
    },
  ],
};

describeIf('schema preview (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let admin: AdminContext;

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
    admin = await seedAdminContext(db);
  });

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post(URL)
      .set('Authorization', `Bearer ${admin.bearerToken}`)
      .send(body as object);

  const rows = async (table: typeof inboundWebhooks | typeof auditLogs) =>
    (await db.select({ n: count() }).from(table))[0].n;

  it('needs an admin session', async () => {
    await request(app.getHttpServer()).post(URL).send({ schema }).expect(401);
  });

  it('returns the docs and an example for a valid schema', async () => {
    const res = await post({ schema, name: 'Recruitment' }).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.markdown).toContain('# Recruitment');
    expect(res.body.examplePayload).toEqual({
      identity: { firstname: 'example' },
    });
  });

  it('previews a schema without steps as a flat payload', async () => {
    const res = await post({
      schema: {
        version: 1,
        fields: [{ key: 'title', type: 'string', required: true }],
      },
      name: 'Workshop created',
    }).expect(200);

    expect(res.body.ok).toBe(true);
    expect(res.body.examplePayload).toEqual({ title: 'example' });
    expect(res.body.markdown).toContain('flat JSON object');
  });

  it('returns every problem with its path, as a normal 200', async () => {
    const res = await post({
      schema: {
        version: 1,
        steps: [
          {
            key: 'identity',
            fields: [
              { key: 'a', type: 'string', required: true, maxlenght: 5 },
            ],
          },
        ],
      },
    }).expect(200);

    expect(res.body).toEqual({
      ok: false,
      errors: [
        expect.objectContaining({
          path: 'steps[0].fields[0].maxlenght',
          code: 'UNKNOWN_PROPERTY',
        }),
      ],
    });
  });

  it('rejects a malformed request and a property it does not know with 400', async () => {
    await post({}).expect(400);
    await post({ schema: 'nope' }).expect(400);
    await post({ schema, surprise: true }).expect(400);
  });

  it('is not taken for another webhook route', async () => {
    const res = await post({ schema }).expect(200);

    expect(res.body).not.toHaveProperty('statusCode');
  });

  it('stores nothing and writes no audit entry', async () => {
    const audits = await rows(auditLogs);

    await post({ schema }).expect(200);
    await post({ schema: { version: 2 } }).expect(200);

    expect(await rows(inboundWebhooks)).toBe(0);
    expect(await rows(auditLogs)).toBe(audits);
  });
});
