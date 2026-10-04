import { count } from 'drizzle-orm';
import {
  inboundWebhookSettings,
  roles,
  servers,
} from '../src/database/entities';
import { InboundWebhooksRepository } from '../src/modules/inbound-webhooks/inbound-webhooks.repository';
import { clearAllTables, closeTestDb, getTestDb, TestDb } from './helpers/db';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

const SERVER = '900000000000000001';
const ROLE_A = '700000000000000001';
const ROLE_B = '700000000000000002';

describeIf('inbound webhook settings (db)', () => {
  let db: TestDb;
  let repository: InboundWebhooksRepository;

  beforeAll(() => {
    db = getTestDb();
    repository = new InboundWebhooksRepository(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearAllTables(db);
  });

  const rows = async () =>
    (await db.select({ n: count() }).from(inboundWebhookSettings))[0].n;

  it('has no row until something is saved, which means "use the environment default"', async () => {
    await expect(repository.getSettings()).resolves.toBeNull();
  });

  it('stores the default reader roles and who set them', async () => {
    await repository.upsertSettings([ROLE_A, ROLE_B], 'admin-1');

    await expect(repository.getSettings()).resolves.toMatchObject({
      id: 1,
      defaultReaderRoleIds: [ROLE_A, ROLE_B],
      updatedBy: 'admin-1',
    });
  });

  it('replaces the list on every save and keeps a single row', async () => {
    await repository.upsertSettings([ROLE_A], 'admin-1');
    await repository.upsertSettings([ROLE_B], 'admin-2');

    expect(await rows()).toBe(1);
    await expect(repository.getSettings()).resolves.toMatchObject({
      defaultReaderRoleIds: [ROLE_B],
      updatedBy: 'admin-2',
    });
  });

  it('keeps an empty list apart from "not configured"', async () => {
    await repository.upsertSettings([], 'admin-1');

    const row = await repository.getSettings();
    expect(row).not.toBeNull();
    expect(row?.defaultReaderRoleIds).toEqual([]);
  });

  it('refuses a second row', async () => {
    await expect(
      db.insert(inboundWebhookSettings).values({ id: 2 }),
    ).rejects.toThrow();
  });

  it('finds roles together with the name of their server', async () => {
    await db.insert(servers).values({
      id: SERVER,
      name: 'Main',
      icon: null,
      isMain: true,
      isActive: true,
      type: 'club',
      syncedAt: new Date(),
    });
    await db.insert(roles).values({
      id: ROLE_A,
      serverId: SERVER,
      name: 'MC Executive',
      color: 0,
      hoist: false,
      position: 1,
      managed: false,
      mentionable: false,
    });

    await expect(
      repository.findExistingRoles([ROLE_A, ROLE_B]),
    ).resolves.toEqual([
      expect.objectContaining({
        id: ROLE_A,
        name: 'MC Executive',
        serverId: SERVER,
        serverName: 'Main',
      }),
    ]);
  });
});
