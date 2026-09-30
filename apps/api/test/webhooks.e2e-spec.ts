import { INestApplication } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { encryptSecret } from '../src/common/utils/encryption.util';
import { webhooks } from '../src/database/entities';
import { DiscordService } from '../src/modules/discord/discord.service';
import { createTestApp } from './helpers/create-app';
import {
  clearAllTables,
  closeTestDb,
  getTestDb,
  ProjectFixture,
  seedAdminContext,
  seedTestProject,
  TestDb,
} from './helpers/db';
import { disableNock, enableNock } from './helpers/discord-mock';

const DB_URL = process.env.DATABASE_URL;
const describeIf = DB_URL ? describe : describe.skip;
const ENCRYPTION_KEY = 'a'.repeat(64);

describeIf('/api/webhooks (e2e)', () => {
  let app: INestApplication;
  let db: TestDb;
  let project: ProjectFixture;
  let webhookId: string;
  let executeWebhook: jest.SpiedFunction<DiscordService['executeWebhook']>;
  let previousEncryptionKey: string | undefined;

  beforeAll(async () => {
    previousEncryptionKey = process.env.WEBHOOK_ENCRYPTION_KEY;
    process.env.WEBHOOK_ENCRYPTION_KEY = ENCRYPTION_KEY;
    enableNock();
    executeWebhook = jest
      .spyOn(DiscordService.prototype, 'executeWebhook')
      .mockResolvedValue(undefined);
    db = getTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    executeWebhook.mockRestore();
    if (previousEncryptionKey === undefined) {
      delete process.env.WEBHOOK_ENCRYPTION_KEY;
    } else {
      process.env.WEBHOOK_ENCRYPTION_KEY = previousEncryptionKey;
    }
    disableNock();
    await closeTestDb();
    await app.close();
  });

  beforeEach(async () => {
    await clearAllTables(db);
    executeWebhook.mockClear();
    const admin = await seedAdminContext(db);
    project = await seedTestProject(db, admin.serverId);
    const [stored] = await db
      .insert(webhooks)
      .values({
        discordWebhookId: '123456789012345678',
        projectId: project.id,
        serverId: admin.serverId,
        channelId: '234567890123456789',
        name: 'deployments',
        avatar: null,
        encryptedToken: encryptSecret('secret-token', ENCRYPTION_KEY),
      })
      .returning({ id: webhooks.id });
    webhookId = stored.id;
  });

  it('executes an owned webhook and records its use', async () => {
    await request(app.getHttpServer())
      .post(`/api/webhooks/${webhookId}/execute`)
      .set('X-API-Key', project.apiKey)
      .send({ content: 'Deployment completed' })
      .expect(204);

    expect(executeWebhook).toHaveBeenCalledWith(
      '123456789012345678',
      'secret-token',
      expect.objectContaining({ content: 'Deployment completed' }),
    );

    const [stored] = await db
      .select({
        usageCount: webhooks.usageCount,
        lastUsedAt: webhooks.lastUsedAt,
      })
      .from(webhooks)
      .where(eq(webhooks.id, webhookId));

    expect(stored.usageCount).toBe(1);
    expect(stored.lastUsedAt).toBeInstanceOf(Date);
  });
});
