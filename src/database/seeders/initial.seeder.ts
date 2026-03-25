import { createHash } from 'crypto';
import { eq, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ProjectScope } from '../../modules/projects/dto/create-project.dto';
import { hashSessionToken } from '../../common/utils/session-token.util';
import * as schema from '../entities';

export async function initialSeeder(db: NodePgDatabase<typeof schema>) {
  console.log('Seeding initial data...');

  console.log('Seeding permissions...');
  // All official Discord permission keys with their bitfield values
  // Source: https://discord.com/developers/docs/topics/permissions
  const permissionsData = [
    {
      key: 'CREATE_INSTANT_INVITE',
      bitfield: 1n,
      description: 'Allows creation of instant invites',
    },
    {
      key: 'KICK_MEMBERS',
      bitfield: 2n,
      description: 'Allows kicking members',
    },
    { key: 'BAN_MEMBERS', bitfield: 4n, description: 'Allows banning members' },
    {
      key: 'ADMINISTRATOR',
      bitfield: 8n,
      description:
        'Grants all permissions, bypasses channel permission overwrites',
    },
    {
      key: 'MANAGE_CHANNELS',
      bitfield: 16n,
      description: 'Allows management and editing of channels',
    },
    {
      key: 'MANAGE_GUILD',
      bitfield: 32n,
      description: 'Allows management and editing of the guild',
    },
    {
      key: 'ADD_REACTIONS',
      bitfield: 64n,
      description: 'Allows adding reactions to messages',
    },
    {
      key: 'VIEW_AUDIT_LOG',
      bitfield: 128n,
      description: 'Allows viewing of the audit log',
    },
    {
      key: 'PRIORITY_SPEAKER',
      bitfield: 256n,
      description: 'Allows using priority speaker in a voice channel',
    },
    {
      key: 'STREAM',
      bitfield: 512n,
      description: 'Allows the user to go live',
    },
    {
      key: 'VIEW_CHANNEL',
      bitfield: 1024n,
      description: 'Allows viewing channels',
    },
    {
      key: 'SEND_MESSAGES',
      bitfield: 2048n,
      description: 'Allows sending messages in text channels',
    },
    {
      key: 'SEND_TTS_MESSAGES',
      bitfield: 4096n,
      description: 'Allows sending /tts messages',
    },
    {
      key: 'MANAGE_MESSAGES',
      bitfield: 8192n,
      description: 'Allows deletion and pinning of messages',
    },
    {
      key: 'EMBED_LINKS',
      bitfield: 16384n,
      description: 'Links sent will have embedded content',
    },
    {
      key: 'ATTACH_FILES',
      bitfield: 32768n,
      description: 'Allows uploading images and files',
    },
    {
      key: 'READ_MESSAGE_HISTORY',
      bitfield: 65536n,
      description: 'Allows reading message history',
    },
    {
      key: 'MENTION_EVERYONE',
      bitfield: 131072n,
      description: 'Allows using @everyone, @here, and all role mentions',
    },
    {
      key: 'USE_EXTERNAL_EMOJIS',
      bitfield: 262144n,
      description: 'Allows using custom emojis from other servers',
    },
    {
      key: 'VIEW_GUILD_INSIGHTS',
      bitfield: 524288n,
      description: 'Allows viewing guild insights',
    },
    {
      key: 'CONNECT',
      bitfield: 1048576n,
      description: 'Allows connecting to voice channels',
    },
    {
      key: 'SPEAK',
      bitfield: 2097152n,
      description: 'Allows speaking in voice channels',
    },
    {
      key: 'MUTE_MEMBERS',
      bitfield: 4194304n,
      description: 'Allows muting members in voice channels',
    },
    {
      key: 'DEAFEN_MEMBERS',
      bitfield: 8388608n,
      description: 'Allows deafening members in voice channels',
    },
    {
      key: 'MOVE_MEMBERS',
      bitfield: 16777216n,
      description: 'Allows moving members between voice channels',
    },
    {
      key: 'USE_VAD',
      bitfield: 33554432n,
      description: 'Allows using voice-activity-detection in voice channels',
    },
    {
      key: 'CHANGE_NICKNAME',
      bitfield: 67108864n,
      description: 'Allows changing own nickname',
    },
    {
      key: 'MANAGE_NICKNAMES',
      bitfield: 134217728n,
      description: 'Allows changing other members nicknames',
    },
    {
      key: 'MANAGE_ROLES',
      bitfield: 268435456n,
      description: 'Allows management and editing of roles',
    },
    {
      key: 'MANAGE_WEBHOOKS',
      bitfield: 536870912n,
      description: 'Allows management and editing of webhooks',
    },
    {
      key: 'MANAGE_GUILD_EXPRESSIONS',
      bitfield: 1073741824n,
      description:
        'Allows management of emojis, stickers, and soundboard sounds',
    },
    {
      key: 'USE_APPLICATION_COMMANDS',
      bitfield: 2147483648n,
      description: 'Allows using slash commands',
    },
    {
      key: 'REQUEST_TO_SPEAK',
      bitfield: 4294967296n,
      description: 'Allows requesting to speak in stage channels',
    },
    {
      key: 'MANAGE_EVENTS',
      bitfield: 8589934592n,
      description: 'Allows management of scheduled events',
    },
    {
      key: 'MANAGE_THREADS',
      bitfield: 17179869184n,
      description: 'Allows deleting and archiving threads',
    },
    {
      key: 'CREATE_PUBLIC_THREADS',
      bitfield: 34359738368n,
      description: 'Allows creating public threads',
    },
    {
      key: 'CREATE_PRIVATE_THREADS',
      bitfield: 68719476736n,
      description: 'Allows creating private threads',
    },
    {
      key: 'USE_EXTERNAL_STICKERS',
      bitfield: 137438953472n,
      description: 'Allows using stickers from other servers',
    },
    {
      key: 'SEND_MESSAGES_IN_THREADS',
      bitfield: 274877906944n,
      description: 'Allows sending messages in threads',
    },
    {
      key: 'USE_EMBEDDED_ACTIVITIES',
      bitfield: 549755813888n,
      description: 'Allows using Activities in voice channels',
    },
    {
      key: 'MODERATE_MEMBERS',
      bitfield: 1099511627776n,
      description: 'Allows timing out members',
    },
    {
      key: 'VIEW_CREATOR_MONETIZATION_ANALYTICS',
      bitfield: 2199023255552n,
      description: 'Allows viewing role subscription insights',
    },
    {
      key: 'USE_SOUNDBOARD',
      bitfield: 4398046511104n,
      description: 'Allows using the soundboard in voice channels',
    },
    {
      key: 'CREATE_GUILD_EXPRESSIONS',
      bitfield: 8796093022208n,
      description: 'Allows creating emojis, stickers, and soundboard sounds',
    },
    {
      key: 'CREATE_EVENTS',
      bitfield: 17592186044416n,
      description: 'Allows creating scheduled events',
    },
    {
      key: 'USE_EXTERNAL_SOUNDS',
      bitfield: 35184372088832n,
      description: 'Allows using external sounds in the soundboard',
    },
    {
      key: 'SEND_VOICE_MESSAGES',
      bitfield: 70368744177664n,
      description: 'Allows sending voice messages',
    },
    {
      key: 'SEND_POLLS',
      bitfield: 562949953421312n,
      description: 'Allows sending polls',
    },
    {
      key: 'USE_EXTERNAL_APPS',
      bitfield: 1125899906842624n,
      description: 'Allows using external apps in a server',
    },
  ];

  const insertedPermissions = await db
    .insert(schema.permissions)
    .values(permissionsData)
    .onConflictDoNothing()
    .returning();

  console.log(`  - Seeded ${insertedPermissions.length} Discord permissions`);
  type RoleInsert = typeof schema.roles.$inferInsert;
  type MemberInsert = typeof schema.members.$inferInsert;
  type ProjectInsert = typeof schema.projects.$inferInsert;
  type ProjectServerInsert = typeof schema.projectServers.$inferInsert;
  type RolePermissionInsert = typeof schema.rolePermissions.$inferInsert;
  type ServerMemberInsert = typeof schema.serverMembers.$inferInsert;
  type ServerMemberRoleInsert = typeof schema.serverMemberRoles.$inferInsert;

  const buildSeededApiKey = (label: string) => {
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20);
    return {
      apiKeyPrefix: `mcdi_pk_seed_${slug}`,
      apiKeyHash: createHash('sha256').update(`seed:${label}`).digest('hex'),
    };
  };

  const discordId = (suffix: number) =>
    `990000000000${suffix.toString().padStart(6, '0')}`;

  const SYSTEM_ADMIN_ID = '1128450529710854185';
  const MAIN_SERVER_ID = '1231588159960387596';
  const COMPETITION_SERVER_ID = discordId(100002);

  const MAIN_EXECUTIVE_ROLE_ID = discordId(200001);
  const MAIN_LEAD_ROLE_ID = discordId(200002);
  const MAIN_MEMBER_ROLE_ID = discordId(200003);
  const COMPETITION_LEAD_ROLE_ID = discordId(200011);
  const COMPETITION_MEMBER_ROLE_ID = discordId(200012);
  const COMPETITION_ORGANIZER_ROLE_ID = discordId(200013);

  const INTERNAL_PROJECT_ID = '11111111-1111-4111-8111-111111111111';
  const EXTERNAL_PROJECT_ID = '22222222-2222-4222-8222-222222222222';
  const PUBLIC_PROJECT_ID = '33333333-3333-4333-8333-333333333333';
  const TEST_PROJECT_ID = '44444444-4444-4444-8444-444444444444';
  const SEEDED_SESSION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const seededServers: (typeof schema.servers.$inferInsert)[] = [
    {
      id: MAIN_SERVER_ID,
      name: 'MicroClub Official',
      icon: null,
      isMain: true,
      type: 'official',
      isActive: true,
      syncFrequencyHours: 1,
      defaultPermissionPolicy: 'deny_all',
      disabledReason: null,
      syncedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: COMPETITION_SERVER_ID,
      name: 'MicroClub Competitions',
      icon: null,
      isMain: false,
      type: 'competition',
      isActive: true,
      syncFrequencyHours: 6,
      defaultPermissionPolicy: 'deny_all',
      disabledReason: null,
      syncedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ];

  console.log('Seeding servers...');
  for (const server of seededServers) {
    await db
      .insert(schema.servers)
      .values(server)
      .onConflictDoUpdate({
        target: schema.servers.id,
        set: {
          name: server.name,
          icon: server.icon,
          isMain: server.isMain,
          type: server.type,
          isActive: server.isActive,
          syncFrequencyHours: server.syncFrequencyHours,
          defaultPermissionPolicy: server.defaultPermissionPolicy,
          disabledReason: server.disabledReason,
          syncedAt: server.syncedAt,
          updatedAt: new Date(),
        },
      });
  }

  const leadPermissionKeys = [
    'MANAGE_EVENTS',
    'CREATE_EVENTS',
    'MANAGE_CHANNELS',
    'MANAGE_ROLES',
    'MANAGE_GUILD',
    'VIEW_AUDIT_LOG',
    'MANAGE_MESSAGES',
    'MANAGE_THREADS',
    'KICK_MEMBERS',
    'BAN_MEMBERS',
    'MODERATE_MEMBERS',
    'VIEW_CHANNEL',
    'READ_MESSAGE_HISTORY',
    'SEND_MESSAGES',
    'VIEW_GUILD_INSIGHTS',
  ];

  const memberPermissionKeys = [
    'VIEW_CHANNEL',
    'READ_MESSAGE_HISTORY',
    'SEND_MESSAGES',
    'ADD_REACTIONS',
    'CONNECT',
    'SPEAK',
    'USE_VAD',
    'CREATE_INSTANT_INVITE',
    'CHANGE_NICKNAME',
    'EMBED_LINKS',
    'ATTACH_FILES',
    'USE_EXTERNAL_EMOJIS',
    'USE_APPLICATION_COMMANDS',
    'SEND_VOICE_MESSAGES',
  ];

  const organizerPermissionKeys = [
    'MANAGE_EVENTS',
    'CREATE_EVENTS',
    'VIEW_CHANNEL',
    'READ_MESSAGE_HISTORY',
    'SEND_MESSAGES',
    'MANAGE_WEBHOOKS',
  ];

  const permissionBitsByKey = new Map(
    permissionsData.map((permission) => [permission.key, permission.bitfield]),
  );

  const buildPermissionsBits = (keys: string[]) =>
    keys.reduce(
      (bits, key) => bits | (permissionBitsByKey.get(key) ?? 0n),
      0n,
    );

  const rolePermissionKeysByRoleId = new Map<string, string[]>([
    [MAIN_EXECUTIVE_ROLE_ID, ['ADMINISTRATOR']],
    [MAIN_LEAD_ROLE_ID, leadPermissionKeys],
    [MAIN_MEMBER_ROLE_ID, memberPermissionKeys],
    [COMPETITION_LEAD_ROLE_ID, leadPermissionKeys],
    [COMPETITION_MEMBER_ROLE_ID, memberPermissionKeys],
    [COMPETITION_ORGANIZER_ROLE_ID, organizerPermissionKeys],
  ]);

  const seededRoles: RoleInsert[] = [
    {
      id: MAIN_EXECUTIVE_ROLE_ID,
      serverId: MAIN_SERVER_ID,
      name: 'Executive',
      color: 0xf1c40f,
      hoist: true,
      position: 1,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(MAIN_EXECUTIVE_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 1,
      isGlobal: false,
    },
    {
      id: MAIN_LEAD_ROLE_ID,
      serverId: MAIN_SERVER_ID,
      name: 'Lead',
      color: 0x3498db,
      hoist: true,
      position: 2,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(MAIN_LEAD_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 2,
      isGlobal: false,
    },
    {
      id: MAIN_MEMBER_ROLE_ID,
      serverId: MAIN_SERVER_ID,
      name: 'Member',
      color: 0x2ecc71,
      hoist: false,
      position: 3,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(MAIN_MEMBER_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 5,
      isGlobal: false,
    },
    {
      id: COMPETITION_LEAD_ROLE_ID,
      serverId: COMPETITION_SERVER_ID,
      name: 'Lead',
      color: 0xe67e22,
      hoist: true,
      position: 1,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(COMPETITION_LEAD_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 2,
      isGlobal: false,
    },
    {
      id: COMPETITION_MEMBER_ROLE_ID,
      serverId: COMPETITION_SERVER_ID,
      name: 'Member',
      color: 0x95a5a6,
      hoist: false,
      position: 2,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(COMPETITION_MEMBER_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 5,
      isGlobal: false,
    },
    {
      id: COMPETITION_ORGANIZER_ROLE_ID,
      serverId: COMPETITION_SERVER_ID,
      name: 'Organizer',
      color: 0x9b59b6,
      hoist: true,
      position: 3,
      managed: false,
      mentionable: true,
      permissionsBits: buildPermissionsBits(
        rolePermissionKeysByRoleId.get(COMPETITION_ORGANIZER_ROLE_ID) ?? [],
      ),
      hierarchyLevel: 3,
      isGlobal: false,
    },
  ];

  console.log('Seeding roles...');
  for (const role of seededRoles) {
    await db
      .insert(schema.roles)
      .values(role)
      .onConflictDoUpdate({
        target: schema.roles.id,
        set: {
          serverId: role.serverId,
          name: role.name,
          color: role.color,
          hoist: role.hoist,
          position: role.position,
          managed: role.managed,
          mentionable: role.mentionable,
          permissionsBits: role.permissionsBits ?? 0n,
          hierarchyLevel: role.hierarchyLevel,
          isGlobal: role.isGlobal ?? false,
          updatedAt: new Date(),
        },
      });
  }

  const allPermissions = await db
    .select()
    .from(schema.permissions)
    .where(inArray(schema.permissions.key, permissionsData.map((p) => p.key)));

  const permissionIdByKey = new Map(
    allPermissions.map((permission) => [permission.key, permission.id]),
  );

  console.log('Seeding role permissions...');
  const rolePermissionsData: RolePermissionInsert[] = [];
  for (const [roleId, permissionKeys] of rolePermissionKeysByRoleId.entries()) {
    for (const permissionKey of permissionKeys) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) continue;
      rolePermissionsData.push({ roleId, permissionId });
    }
  }

  if (rolePermissionsData.length) {
    await db
      .insert(schema.rolePermissions)
      .values(rolePermissionsData)
      .onConflictDoNothing();
  }

  const seededMembers: MemberInsert[] = [
    {
      id: SYSTEM_ADMIN_ID,
      username: 'ben_abdou5094',
      globalName: 'THE JOAT',
      displayName: null,
      avatar:
        'https://cdn.discordapp.com/avatars/1128450529710854185/1b7ba1c3200c303760a64e38d6bf42b1.webp',
      email: null,
      isClubMember: true,
      isSystemAdmin: true,
      joinedAt: new Date('2024-04-21T12:51:39.482Z'),
      syncedAt: new Date('2026-03-07T02:22:56.321Z'),
    },
    {
      id: discordId(300002),
      username: 'seed_lead',
      globalName: 'Seed Lead',
      displayName: 'Lead Seed',
      avatar: null,
      email: 'seed.lead@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-10T10:00:00.000Z'),
      syncedAt: new Date('2026-01-10T10:00:00.000Z'),
    },
    {
      id: discordId(300003),
      username: 'seed_member',
      globalName: 'Seed Member',
      displayName: 'Member Seed',
      avatar: null,
      email: 'seed.member@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-11T10:00:00.000Z'),
      syncedAt: new Date('2026-01-11T10:00:00.000Z'),
    },
    {
      id: discordId(300004),
      username: 'seed_organizer',
      globalName: 'Seed Organizer',
      displayName: 'Organizer Seed',
      avatar: null,
      email: 'seed.organizer@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-12T10:00:00.000Z'),
      syncedAt: new Date('2026-01-12T10:00:00.000Z'),
    },
    {
      id: discordId(300005),
      username: 'seed_member_05',
      globalName: 'Seed Member 05',
      displayName: 'Seed 05',
      avatar: null,
      email: 'seed05@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-13T10:00:00.000Z'),
      syncedAt: new Date('2026-01-13T10:00:00.000Z'),
    },
    {
      id: discordId(300006),
      username: 'seed_member_06',
      globalName: 'Seed Member 06',
      displayName: 'Seed 06',
      avatar: null,
      email: 'seed06@example.com',
      isClubMember: false,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-14T10:00:00.000Z'),
      syncedAt: new Date('2026-01-14T10:00:00.000Z'),
    },
    {
      id: discordId(300007),
      username: 'seed_member_07',
      globalName: 'Seed Member 07',
      displayName: 'Seed 07',
      avatar: null,
      email: 'seed07@example.com',
      isClubMember: false,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-15T10:00:00.000Z'),
      syncedAt: new Date('2026-01-15T10:00:00.000Z'),
    },
    {
      id: discordId(300008),
      username: 'seed_member_08',
      globalName: 'Seed Member 08',
      displayName: 'Seed 08',
      avatar: null,
      email: 'seed08@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-16T10:00:00.000Z'),
      syncedAt: new Date('2026-01-16T10:00:00.000Z'),
    },
    {
      id: discordId(300009),
      username: 'seed_member_09',
      globalName: 'Seed Member 09',
      displayName: 'Seed 09',
      avatar: null,
      email: 'seed09@example.com',
      isClubMember: true,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-17T10:00:00.000Z'),
      syncedAt: new Date('2026-01-17T10:00:00.000Z'),
    },
    {
      id: discordId(300010),
      username: 'seed_member_10',
      globalName: 'Seed Member 10',
      displayName: 'Seed 10',
      avatar: null,
      email: 'seed10@example.com',
      isClubMember: false,
      isSystemAdmin: false,
      joinedAt: new Date('2025-01-18T10:00:00.000Z'),
      syncedAt: new Date('2026-01-18T10:00:00.000Z'),
    },
  ];

  console.log('Seeding members...');
  for (const member of seededMembers) {
    await db
      .insert(schema.members)
      .values(member)
      .onConflictDoUpdate({
        target: schema.members.id,
        set: {
          username: member.username,
          globalName: member.globalName,
          displayName: member.displayName,
          avatar: member.avatar,
          email: member.email,
          isClubMember: member.isClubMember,
          isSystemAdmin: member.isSystemAdmin ?? false,
          joinedAt: member.joinedAt,
          syncedAt: member.syncedAt,
          updatedAt: new Date(),
        },
      });
  }

  console.log('Seeding server memberships...');
  const serverMembersData: ServerMemberInsert[] = [
    ...seededMembers.map((member) => ({
      serverId: MAIN_SERVER_ID,
      memberId: member.id,
      joinedAt: member.joinedAt ?? new Date('2025-01-01T10:00:00.000Z'),
      isActive: true,
      lastSyncedAt: member.syncedAt ?? new Date('2026-01-01T10:00:00.000Z'),
    })),
    {
      serverId: COMPETITION_SERVER_ID,
      memberId: SYSTEM_ADMIN_ID,
      joinedAt: new Date('2025-02-01T09:00:00.000Z'),
      isActive: true,
      lastSyncedAt: new Date('2026-02-01T09:00:00.000Z'),
    },
    {
      serverId: COMPETITION_SERVER_ID,
      memberId: discordId(300002),
      joinedAt: new Date('2025-02-02T09:00:00.000Z'),
      isActive: true,
      lastSyncedAt: new Date('2026-02-02T09:00:00.000Z'),
    },
    {
      serverId: COMPETITION_SERVER_ID,
      memberId: discordId(300003),
      joinedAt: new Date('2025-02-03T09:00:00.000Z'),
      isActive: true,
      lastSyncedAt: new Date('2026-02-03T09:00:00.000Z'),
    },
    {
      serverId: COMPETITION_SERVER_ID,
      memberId: discordId(300004),
      joinedAt: new Date('2025-02-04T09:00:00.000Z'),
      isActive: true,
      lastSyncedAt: new Date('2026-02-04T09:00:00.000Z'),
    },
  ];

  await db
    .insert(schema.serverMembers)
    .values(serverMembersData)
    .onConflictDoNothing();

  console.log('Seeding server member roles...');
  const memberRolesData: ServerMemberRoleInsert[] = [
    { memberId: SYSTEM_ADMIN_ID, roleId: MAIN_EXECUTIVE_ROLE_ID },
    { memberId: discordId(300002), roleId: MAIN_LEAD_ROLE_ID },
    { memberId: discordId(300003), roleId: MAIN_MEMBER_ROLE_ID },
    { memberId: discordId(300004), roleId: COMPETITION_ORGANIZER_ROLE_ID },
    { memberId: discordId(300002), roleId: COMPETITION_MEMBER_ROLE_ID },
    { memberId: discordId(300003), roleId: COMPETITION_MEMBER_ROLE_ID },
  ];

  await db
    .insert(schema.serverMemberRoles)
    .values(memberRolesData)
    .onConflictDoNothing();

  console.log('Seeding projects...');
  const internalProject: ProjectInsert = {
    id: INTERNAL_PROJECT_ID,
    name: 'MicroClub Events',
    description: 'Internal events management platform',
    isInternal: true,
    isActive: true,
    webhookUrl: 'https://example.com/webhooks/internal-events',
    redirectUri: 'http://localhost:4000/auth/callback',
    ...buildSeededApiKey('microclub-events'),
  };

  const externalProject: ProjectInsert = {
    id: EXTERNAL_PROJECT_ID,
    name: 'External Dashboard',
    description: 'External client dashboard with role restrictions',
    isInternal: false,
    isActive: true,
    webhookUrl: 'https://example.com/webhooks/external-dashboard',
    redirectUri: 'http://localhost:5000/auth/callback',
    ...buildSeededApiKey('external-dashboard'),
  };

  const publicProject: ProjectInsert = {
    id: PUBLIC_PROJECT_ID,
    name: 'MCDI Dashboard',
    description: 'Public dashboard for MicroClub',
    isInternal: false,
    isActive: true,
    webhookUrl: 'https://example.com/webhooks/public-dashboard',
    redirectUri: 'http://localhost:3001/auth/callback',
    ...buildSeededApiKey('mcdi-dashboard'),
  };

  const testProject: ProjectInsert = {
    id: TEST_PROJECT_ID,
    name: 'Test Project',
    description: 'Development project for server-scoped access checks',
    isInternal: false,
    isActive: true,
    webhookUrl: 'https://example.com/webhooks/test-project',
    redirectUri: 'http://localhost:4001/auth/callback',
    ...buildSeededApiKey('test-project'),
  };

  const seededProjects = [
    internalProject,
    externalProject,
    publicProject,
    testProject,
  ];

  for (const project of seededProjects) {
    if (!project.id) {
      throw new Error(`Seed project "${project.name}" is missing id`);
    }

    const projectId = project.id;

    const upsertData = {
      name: project.name,
      description: project.description,
      apiKeyHash: project.apiKeyHash,
      apiKeyPrefix: project.apiKeyPrefix,
      apiKeyCreatedAt: project.apiKeyCreatedAt ?? new Date(),
      webhookUrl: project.webhookUrl,
      redirectUri: project.redirectUri,
      isInternal: project.isInternal ?? false,
      isActive: project.isActive ?? true,
      updatedAt: new Date(),
    };

    const existingById = await db
      .select({ id: schema.projects.id })
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1);

    if (existingById.length > 0) {
      await db
        .update(schema.projects)
        .set(upsertData)
        .where(eq(schema.projects.id, projectId));
      continue;
    }

    await db
      .insert(schema.projects)
      .values(project)
      .onConflictDoUpdate({
        target: schema.projects.name,
        set: upsertData,
      });
  }

  const seededProjectRows = await db
    .select({
      id: schema.projects.id,
      name: schema.projects.name,
      apiKeyPrefix: schema.projects.apiKeyPrefix,
    })
    .from(schema.projects)
    .where(inArray(schema.projects.name, seededProjects.map((p) => p.name)));

  const projectIdByName = new Map(
    seededProjectRows.map((project) => [project.name, project.id]),
  );

  console.log('Linking projects to servers...');
  const allScopes = Object.values(ProjectScope);

  const projectServersData: ProjectServerInsert[] = [
    {
      projectId: projectIdByName.get(internalProject.name)!,
      serverId: MAIN_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: true },
      scopes: allScopes,
    },
    {
      projectId: projectIdByName.get(internalProject.name)!,
      serverId: COMPETITION_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: true },
      scopes: allScopes,
    },
    {
      projectId: projectIdByName.get(externalProject.name)!,
      serverId: MAIN_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: false, MANAGE_WEBHOOKS: false },
      scopes: allScopes,
    },
    {
      projectId: projectIdByName.get(publicProject.name)!,
      serverId: MAIN_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: false },
      scopes: allScopes,
    },
    {
      projectId: projectIdByName.get(testProject.name)!,
      serverId: MAIN_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: false },
      scopes: allScopes,
    },
    {
      projectId: projectIdByName.get(testProject.name)!,
      serverId: COMPETITION_SERVER_ID,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: false },
      scopes: allScopes,
    },
  ];

  for (const access of projectServersData) {
    await db
      .insert(schema.projectServers)
      .values(access)
      .onConflictDoUpdate({
        target: [schema.projectServers.projectId, schema.projectServers.serverId],
        set: {
          operations: access.operations,
          scopes: access.scopes ?? [],
          updatedAt: new Date(),
        },
      });
  }

  console.log('Seeding project role restrictions...');
  await db
    .insert(schema.projectRoles)
    .values([
      {
        projectId: projectIdByName.get(externalProject.name)!,
        roleId: MAIN_EXECUTIVE_ROLE_ID,
      },
      {
        projectId: projectIdByName.get(externalProject.name)!,
        roleId: MAIN_LEAD_ROLE_ID,
      },
    ])
    .onConflictDoNothing();

  console.log('Seeding role inheritance rules...');
  const seededInheritanceRules = [
    {
      sourceRoleId: MAIN_EXECUTIVE_ROLE_ID,
      targetScope: 'all' as const,
      enabled: true,
      targetServerIds: [] as string[],
    },
    {
      sourceRoleId: MAIN_LEAD_ROLE_ID,
      targetScope: 'selected' as const,
      enabled: true,
      targetServerIds: [COMPETITION_SERVER_ID],
    },
  ];

  for (const rule of seededInheritanceRules) {
    const [existingRule] = await db
      .select({ id: schema.roleInheritanceRules.id })
      .from(schema.roleInheritanceRules)
      .where(eq(schema.roleInheritanceRules.sourceRoleId, rule.sourceRoleId))
      .limit(1);

    const ruleId =
      existingRule?.id ??
      (
        await db
          .insert(schema.roleInheritanceRules)
          .values({
            sourceRoleId: rule.sourceRoleId,
            targetScope: rule.targetScope,
            enabled: rule.enabled,
          })
          .returning({ id: schema.roleInheritanceRules.id })
      )[0].id;

    if (existingRule) {
      await db
        .update(schema.roleInheritanceRules)
        .set({
          targetScope: rule.targetScope,
          enabled: rule.enabled,
          updatedAt: new Date(),
        })
        .where(eq(schema.roleInheritanceRules.id, ruleId));
    }

    if (rule.targetServerIds.length) {
      await db
        .insert(schema.roleInheritanceRuleTargets)
        .values(
          rule.targetServerIds.map((targetServerId) => ({
            ruleId,
            targetServerId,
          })),
        )
        .onConflictDoNothing();
    }
  }

  console.log('Seeding test session...');
  await db
    .insert(schema.sessions)
    .values({
      id: SEEDED_SESSION_ID,
      memberId: SYSTEM_ADMIN_ID,
      projectId: projectIdByName.get(internalProject.name)!,
      serverId: MAIN_SERVER_ID,
      token: hashSessionToken('mcdi_seed_admin_session_token'),
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
    })
    .onConflictDoUpdate({
      target: schema.sessions.id,
      set: {
        memberId: SYSTEM_ADMIN_ID,
        projectId: projectIdByName.get(internalProject.name)!,
        serverId: MAIN_SERVER_ID,
        token: hashSessionToken('mcdi_seed_admin_session_token'),
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      },
    });

  console.log('Initial seeding completed!');
  console.log('\n=== TEST DATA SUMMARY ===');
  console.log(`Servers: ${MAIN_SERVER_ID} (main), ${COMPETITION_SERVER_ID} (competition)`);
  console.log(
    `Roles: ${seededRoles.map((role) => `${role.name} (${role.id})`).join(', ')}`,
  );
  console.log(`Members: ${seededMembers.length} deterministic seed members`);
  console.log(
    `  - System admin: ${SYSTEM_ADMIN_ID} (ben_abdou5094) -> Executive`,
  );
  console.log(
    `  - Lead test member: ${discordId(300002)} (seed_lead) -> Lead`,
  );
  console.log(
    `  - Member test member: ${discordId(300003)} (seed_member) -> Member`,
  );
  console.log('\nProjects:');
  console.log(
    `  1. Internal: "${internalProject.name}" (Prefix: ${internalProject.apiKeyPrefix})`,
  );
  console.log(
    `     - Access: main + competition servers, all scopes, full operations`,
  );
  console.log(
    `  2. External: "${externalProject.name}" (Prefix: ${externalProject.apiKeyPrefix})`,
  );
  console.log(`     - Access: main server only`);
  console.log(`     - Requires Executive OR Lead role`);
  console.log(
    `  3. Public: "${publicProject.name}" (Prefix: ${publicProject.apiKeyPrefix})`,
  );
  console.log(`     - Access: main server only`);
  console.log(
    `  4. Test: "${testProject.name}" (Prefix: ${testProject.apiKeyPrefix})`,
  );
  console.log(`     - Access: main + competition servers`);
  console.log('Inheritance rules:');
  console.log('  - Executive role inherits to all servers');
  console.log(
    `  - Lead role inherits to selected server ${COMPETITION_SERVER_ID}`,
  );
  console.log('========================\n');
}
