import { eq } from 'drizzle-orm';
import {
  inboundWebhookRoles,
  inboundWebhooks,
  members,
  roleInheritanceRuleTargets,
  roleInheritanceRules,
  roles,
  serverMemberRoles,
  servers,
} from '../src/database/entities';
import { InboundWebhooksRepository } from '../src/modules/inbound-webhooks/inbound-webhooks.repository';
import {
  clearAllTables,
  closeTestDb,
  getTestDb,
  seedTestProject,
  TestDb,
} from './helpers/db';

const describeIf = process.env.DATABASE_URL ? describe : describe.skip;

const MAIN = '900000000000000001';
const EVENTS = '900000000000000002';
const OTHER = '900000000000000003';

const ids = {
  mainPresident: '700000000000000001',
  eventsPresident: '700000000000000002',
  otherPresident: '700000000000000003',
  mainIntern: '700000000000000004',
  eventsMember: '700000000000000005',
};

const MEMBER = {
  president: '800000000000000001',
  intern: '800000000000000002',
  outsider: '800000000000000003',
  direct: '800000000000000004',
};

const SCHEMA = {
  version: 1 as const,
  steps: [
    {
      key: 'step',
      fields: [{ key: 'a', type: 'string' as const, required: false }],
    },
  ],
};

describeIf('inbound webhook reads through role inheritance (db)', () => {
  let db: TestDb;
  let repository: InboundWebhooksRepository;
  let projectId: string;
  let ruleId: number;
  const webhook: Record<string, string> = {};

  async function addServer(id: string, name: string, isMain = false) {
    await db.insert(servers).values({
      id,
      name,
      icon: null,
      isMain,
      isActive: true,
      type: 'club',
      syncedAt: new Date(),
    });
  }

  async function addRole(id: string, serverId: string, name: string) {
    await db.insert(roles).values({
      id,
      serverId,
      name,
      color: 0,
      hoist: false,
      position: 1,
      managed: false,
      mentionable: false,
    });
  }

  async function addMember(id: string, ...roleIds: string[]) {
    await db.insert(members).values({
      id,
      username: `member_${id}`,
      globalName: null,
      displayName: null,
      avatar: null,
      isClubMember: true,
      joinedAt: new Date(),
      syncedAt: new Date(),
    });
    for (const roleId of roleIds) {
      await db.insert(serverMemberRoles).values({ memberId: id, roleId });
    }
  }

  async function addWebhook(
    key: string,
    grantedRoleId: string,
    allowRoleInheritance: boolean,
  ) {
    const [row] = await db
      .insert(inboundWebhooks)
      .values({
        projectId,
        name: key,
        slug: key,
        schema: SCHEMA,
        signingSecretEnc: 'x',
        allowRoleInheritance,
      })
      .returning({ id: inboundWebhooks.id });
    await db
      .insert(inboundWebhookRoles)
      .values({ webhookId: row.id, roleId: grantedRoleId });
    webhook[key] = row.id;
  }

  beforeAll(() => {
    db = getTestDb();
    repository = new InboundWebhooksRepository(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  // The "President" role of the main server inherits into EVENTS only; OTHER
  // has a role with the same name that the rule does not reach.
  beforeEach(async () => {
    await clearAllTables(db);
    await addServer(MAIN, 'Main', true);
    await addServer(EVENTS, 'Events');
    await addServer(OTHER, 'Other');
    await addRole(ids.mainPresident, MAIN, 'President');
    await addRole(ids.eventsPresident, EVENTS, ' president ');
    await addRole(ids.otherPresident, OTHER, 'President');
    await addRole(ids.mainIntern, MAIN, 'Intern');
    await addRole(ids.eventsMember, EVENTS, 'Member');

    await addMember(MEMBER.president, ids.mainPresident);
    await addMember(MEMBER.intern, ids.mainIntern);
    await addMember(MEMBER.outsider);
    await addMember(MEMBER.direct, ids.eventsPresident);

    const [rule] = await db
      .insert(roleInheritanceRules)
      .values({
        sourceRoleId: ids.mainPresident,
        targetScope: 'selected',
        enabled: true,
      })
      .returning({ id: roleInheritanceRules.id });
    ruleId = rule.id;
    await db
      .insert(roleInheritanceRuleTargets)
      .values({ ruleId, targetServerId: EVENTS });

    projectId = (await seedTestProject(db, MAIN)).id;
    await addWebhook('events-on', ids.eventsPresident, true);
    await addWebhook('events-off', ids.eventsPresident, false);
    await addWebhook('other-on', ids.otherPresident, true);
    await addWebhook('main-on', ids.mainPresident, true);
  });

  describe('findInheritedGrantRoleId', () => {
    it('grants a member whose main-server role is the rule source', async () => {
      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['events-on'],
        ),
      ).resolves.toBe(ids.eventsPresident);
    });

    it('does nothing while the webhook has the flag off', async () => {
      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['events-off'],
        ),
      ).resolves.toBeNull();
    });

    it('does not reach a server the rule does not target', async () => {
      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['other-on'],
        ),
      ).resolves.toBeNull();
    });

    it('reaches every server when the rule targets all', async () => {
      await db
        .update(roleInheritanceRules)
        .set({ targetScope: 'all' })
        .where(eq(roleInheritanceRules.id, ruleId));

      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['other-on'],
        ),
      ).resolves.toBe(ids.otherPresident);
    });

    it('ignores a disabled rule', async () => {
      await db
        .update(roleInheritanceRules)
        .set({ enabled: false })
        .where(eq(roleInheritanceRules.id, ruleId));

      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['events-on'],
        ),
      ).resolves.toBeNull();
    });

    it('is not for members without a source role', async () => {
      for (const member of [MEMBER.intern, MEMBER.outsider]) {
        await expect(
          repository.findInheritedGrantRoleId(member, webhook['events-on']),
        ).resolves.toBeNull();
      }
    });

    it('never treats a role granted on the main server as inherited', async () => {
      await expect(
        repository.findInheritedGrantRoleId(
          MEMBER.president,
          webhook['main-on'],
        ),
      ).resolves.toBeNull();
    });
  });

  describe('listReadableByMember', () => {
    const idsOf = async (member: string) =>
      (await repository.listReadableByMember(member)).map((w) => w.id).sort();

    it('adds the webhooks reached through inheritance to the directly granted ones', async () => {
      // events-on by inheritance; main-on because they hold its granted role
      await expect(idsOf(MEMBER.president)).resolves.toEqual(
        [webhook['events-on'], webhook['main-on']].sort(),
      );
    });

    it('leaves out webhooks that did not opt in', async () => {
      expect(await idsOf(MEMBER.president)).not.toContain(
        webhook['events-off'],
      );
    });

    it('keeps a webhook read directly, and the inherited ones are not duplicated', async () => {
      await addMember(
        '800000000000000009',
        ids.eventsPresident,
        ids.mainPresident,
      );

      // events-on is both direct and inherited: listed once
      await expect(idsOf('800000000000000009')).resolves.toEqual(
        [
          webhook['events-on'],
          webhook['events-off'],
          webhook['main-on'],
        ].sort(),
      );
    });

    it('lists nothing for a member with neither a grant nor a source role', async () => {
      await expect(idsOf(MEMBER.outsider)).resolves.toEqual([]);
    });

    it('stays newest first', async () => {
      await addMember(
        '800000000000000010',
        ids.eventsPresident,
        ids.mainPresident,
      );

      const listed =
        await repository.listReadableByMember('800000000000000010');

      const times = listed.map((w) => w.createdAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });
  });
});
