import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../entities';
import { createMemberFactory } from '../factories/member.factory';
import { createServerFactory } from '../factories/server.factory';
import { createProjectFactory } from '../factories/project.factory';
import { createAllScopesFactory } from '../factories/project-scope.factory';
import { createRoleFactory } from '../factories/role.factory';
import { createPermissionFactory } from '../factories/permission.factory';
import { createProjectRoleFactory } from '../factories/project-role.factory';
import { createSessionFactory } from '../factories/session.factory';

export async function initialSeeder(db: NodePgDatabase<typeof schema>) {
  console.log('Seeding initial data...');

  console.log('Seeding permissions...');
  // All official Discord permission keys with their bitfield values
  // Source: https://discord.com/developers/docs/topics/permissions
  const permissionsData = [
    { key: 'CREATE_INSTANT_INVITE', bitfield: 1n, description: 'Allows creation of instant invites' },
    { key: 'KICK_MEMBERS', bitfield: 2n, description: 'Allows kicking members' },
    { key: 'BAN_MEMBERS', bitfield: 4n, description: 'Allows banning members' },
    { key: 'ADMINISTRATOR', bitfield: 8n, description: 'Grants all permissions, bypasses channel permission overwrites' },
    { key: 'MANAGE_CHANNELS', bitfield: 16n, description: 'Allows management and editing of channels' },
    { key: 'MANAGE_GUILD', bitfield: 32n, description: 'Allows management and editing of the guild' },
    { key: 'ADD_REACTIONS', bitfield: 64n, description: 'Allows adding reactions to messages' },
    { key: 'VIEW_AUDIT_LOG', bitfield: 128n, description: 'Allows viewing of the audit log' },
    { key: 'PRIORITY_SPEAKER', bitfield: 256n, description: 'Allows using priority speaker in a voice channel' },
    { key: 'STREAM', bitfield: 512n, description: 'Allows the user to go live' },
    { key: 'VIEW_CHANNEL', bitfield: 1024n, description: 'Allows viewing channels' },
    { key: 'SEND_MESSAGES', bitfield: 2048n, description: 'Allows sending messages in text channels' },
    { key: 'SEND_TTS_MESSAGES', bitfield: 4096n, description: 'Allows sending /tts messages' },
    { key: 'MANAGE_MESSAGES', bitfield: 8192n, description: 'Allows deletion and pinning of messages' },
    { key: 'EMBED_LINKS', bitfield: 16384n, description: 'Links sent will have embedded content' },
    { key: 'ATTACH_FILES', bitfield: 32768n, description: 'Allows uploading images and files' },
    { key: 'READ_MESSAGE_HISTORY', bitfield: 65536n, description: 'Allows reading message history' },
    { key: 'MENTION_EVERYONE', bitfield: 131072n, description: 'Allows using @everyone, @here, and all role mentions' },
    { key: 'USE_EXTERNAL_EMOJIS', bitfield: 262144n, description: 'Allows using custom emojis from other servers' },
    { key: 'VIEW_GUILD_INSIGHTS', bitfield: 524288n, description: 'Allows viewing guild insights' },
    { key: 'CONNECT', bitfield: 1048576n, description: 'Allows connecting to voice channels' },
    { key: 'SPEAK', bitfield: 2097152n, description: 'Allows speaking in voice channels' },
    { key: 'MUTE_MEMBERS', bitfield: 4194304n, description: 'Allows muting members in voice channels' },
    { key: 'DEAFEN_MEMBERS', bitfield: 8388608n, description: 'Allows deafening members in voice channels' },
    { key: 'MOVE_MEMBERS', bitfield: 16777216n, description: 'Allows moving members between voice channels' },
    { key: 'USE_VAD', bitfield: 33554432n, description: 'Allows using voice-activity-detection in voice channels' },
    { key: 'CHANGE_NICKNAME', bitfield: 67108864n, description: 'Allows changing own nickname' },
    { key: 'MANAGE_NICKNAMES', bitfield: 134217728n, description: 'Allows changing other members nicknames' },
    { key: 'MANAGE_ROLES', bitfield: 268435456n, description: 'Allows management and editing of roles' },
    { key: 'MANAGE_WEBHOOKS', bitfield: 536870912n, description: 'Allows management and editing of webhooks' },
    { key: 'MANAGE_GUILD_EXPRESSIONS', bitfield: 1073741824n, description: 'Allows management of emojis, stickers, and soundboard sounds' },
    { key: 'USE_APPLICATION_COMMANDS', bitfield: 2147483648n, description: 'Allows using slash commands' },
    { key: 'REQUEST_TO_SPEAK', bitfield: 4294967296n, description: 'Allows requesting to speak in stage channels' },
    { key: 'MANAGE_EVENTS', bitfield: 8589934592n, description: 'Allows management of scheduled events' },
    { key: 'MANAGE_THREADS', bitfield: 17179869184n, description: 'Allows deleting and archiving threads' },
    { key: 'CREATE_PUBLIC_THREADS', bitfield: 34359738368n, description: 'Allows creating public threads' },
    { key: 'CREATE_PRIVATE_THREADS', bitfield: 68719476736n, description: 'Allows creating private threads' },
    { key: 'USE_EXTERNAL_STICKERS', bitfield: 137438953472n, description: 'Allows using stickers from other servers' },
    { key: 'SEND_MESSAGES_IN_THREADS', bitfield: 274877906944n, description: 'Allows sending messages in threads' },
    { key: 'USE_EMBEDDED_ACTIVITIES', bitfield: 549755813888n, description: 'Allows using Activities in voice channels' },
    { key: 'MODERATE_MEMBERS', bitfield: 1099511627776n, description: 'Allows timing out members' },
    { key: 'VIEW_CREATOR_MONETIZATION_ANALYTICS', bitfield: 2199023255552n, description: 'Allows viewing role subscription insights' },
    { key: 'USE_SOUNDBOARD', bitfield: 4398046511104n, description: 'Allows using the soundboard in voice channels' },
    { key: 'CREATE_GUILD_EXPRESSIONS', bitfield: 8796093022208n, description: 'Allows creating emojis, stickers, and soundboard sounds' },
    { key: 'CREATE_EVENTS', bitfield: 17592186044416n, description: 'Allows creating scheduled events' },
    { key: 'USE_EXTERNAL_SOUNDS', bitfield: 35184372088832n, description: 'Allows using external sounds in the soundboard' },
    { key: 'SEND_VOICE_MESSAGES', bitfield: 70368744177664n, description: 'Allows sending voice messages' },
    { key: 'SEND_POLLS', bitfield: 562949953421312n, description: 'Allows sending polls' },
    { key: 'USE_EXTERNAL_APPS', bitfield: 1125899906842624n, description: 'Allows using external apps in a server' },
  ];

  const insertedPermissions = await db
    .insert(schema.permissions)
    .values(permissionsData)
    .onConflictDoNothing()
    .returning();

  console.log(`  - Seeded ${insertedPermissions.length} Discord permissions`);

  console.log('  - Seeding main server...');
  const mainServer = createServerFactory({
    id: '1231588159960387596', // Real Discord Guild ID
    name: 'MicroClub Official',
    isMain: true,
    type: 'official',
  });

  const [insertedServer] = await db
    .insert(schema.servers)
    .values(mainServer)
    .onConflictDoNothing()
    .returning();

  const serverId = insertedServer?.id || mainServer.id;
  console.log(`  - Seeding roles for server ${serverId}...`);
  const rolesData = [
    createRoleFactory(serverId, { name: 'Executive', position: 1, hierarchyLevel: 1 }),
    createRoleFactory(serverId, { name: 'Lead', position: 2, hierarchyLevel: 2 }),
    createRoleFactory(serverId, { name: 'Member', position: 3, hierarchyLevel: 5 }),
  ];
  const insertedRoles = await db
    .insert(schema.roles)
    .values(rolesData)
    .onConflictDoNothing()
    .returning();

  console.log('Seeding role permissions...');
  // Re-fetch all permissions so we always resolve by key, even if rows already existed
  const allPermissions = await db.select().from(schema.permissions);
  if (insertedRoles.length > 0 && allPermissions.length > 0) {
    const rolePermissionsData: { roleId: string; permissionId: number }[] = [];

    const getPermId = (key: string) =>
      allPermissions.find((p) => p.key === key)?.id;

    // 1. Executive Role gets ADMINISTRATOR (automatically inherits all)
    const executiveRole = insertedRoles.find((r) => r.name === 'Executive');
    const adminPerm = getPermId('ADMINISTRATOR');
    if (executiveRole && adminPerm) {
      rolePermissionsData.push({ roleId: executiveRole.id, permissionId: adminPerm });
    }

    // 2. Lead Role gets management-level permissions
    const leadRole = insertedRoles.find((r) => r.name === 'Lead');
    if (leadRole) {
      const leadPerms = [
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
      for (const p of leadPerms) {
        const id = getPermId(p);
        if (id) rolePermissionsData.push({ roleId: leadRole.id, permissionId: id });
      }
    }

    // 3. Member Role gets basic view/communication permissions
    const memberRole = insertedRoles.find((r) => r.name === 'Member');
    if (memberRole) {
      const memberPerms = [
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
      for (const p of memberPerms) {
        const id = getPermId(p);
        if (id) rolePermissionsData.push({ roleId: memberRole.id, permissionId: id });
      }
    }

    if (rolePermissionsData.length > 0) {
      await db
        .insert(schema.rolePermissions)
        .values(rolePermissionsData)
        .onConflictDoNothing();
    }
  }


  console.log('Seeding members...');
  const membersData = Array.from({ length: 10 }).map(() =>
    createMemberFactory(),
  );
  const insertedMembers = await db
    .insert(schema.members)
    .values(membersData)
    .onConflictDoNothing()
    .returning();

  // Seed a dedicated admin member with Executive role for testing
  const adminMember = createMemberFactory({
    username: 'mcdi_admin',
    globalName: 'MCDI Admin',
    isClubMember: true,
  });
  const [insertedAdmin] = await db
    .insert(schema.members)
    .values(adminMember)
    .onConflictDoNothing()
    .returning();

  const allMembers = [
    ...insertedMembers,
    ...(insertedAdmin ? [insertedAdmin] : []),
  ];

  console.log('Seeding server members...');
  if (allMembers.length > 0) {
    const serverMembersData = allMembers.map((m) => ({
      serverId: serverId,
      memberId: m.id,
      joinedAt: new Date(),
    }));
    await db
      .insert(schema.serverMembers)
      .values(serverMembersData)
      .onConflictDoNothing();

    // Assign roles to the first 3 members
    console.log('Seeding server member roles...');
    if (insertedRoles.length > 0) {
      const memberRolesData: { memberId: string; roleId: string; assignedAt: Date }[] = [];

      // First member gets Admin role
      if (insertedMembers[0] && insertedRoles[0]) {
        memberRolesData.push({
          memberId: insertedMembers[0].id,
          roleId: insertedRoles[0].id,
          assignedAt: new Date(),
        });
      }

      // Second member gets Lead role
      if (insertedMembers[1] && insertedRoles[1]) {
        memberRolesData.push({
          memberId: insertedMembers[1].id,
          roleId: insertedRoles[1].id,
          assignedAt: new Date(),
        });
      }

      // Third member gets Member role
      if (insertedMembers[2] && insertedRoles[2]) {
        memberRolesData.push({
          memberId: insertedMembers[2].id,
          roleId: insertedRoles[2].id,
          assignedAt: new Date(),
        });
      }

      if (memberRolesData.length > 0) {
        await db
          .insert(schema.serverMemberRoles)
          .values(memberRolesData)
          .onConflictDoNothing();
      }
    }
  }

  console.log('Seeding projects...');

  // 1. Internal project (MicroClub Events) - uses main server, no role restrictions
  const internalProject = createProjectFactory({
    name: 'MicroClub Events',
    description: 'Internal events management platform',
    isInternal: true,
    redirectUri: 'http://localhost:4000/auth/callback',
  });

  // 2. External project (External Dashboard) - requires Lead or Admin role
  const externalProject = createProjectFactory({
    name: 'External Dashboard',
    description: 'External client dashboard with role restrictions',
    isInternal: false,
    redirectUri: 'http://localhost:5000/auth/callback',
  });

  // Assign Executive role to the admin member
  if (insertedAdmin) {
    const executiveRole = insertedRoles.find((r) => r.name === 'Executive');
    if (executiveRole) {
      await db
        .insert(schema.serverMemberRoles)
        .values({ memberId: insertedAdmin.id, roleId: executiveRole.id })
        .onConflictDoNothing();
    }

    // Seed a test session for the admin member (expires in 30 days)
    const adminSession = createSessionFactory(insertedAdmin.id, {
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await db.insert(schema.sessions).values(adminSession).onConflictDoNothing();
    console.log(`  - Admin session token: ${adminSession.token}`);
  }

  // 3. Public project (MCDI Dashboard) - no role restrictions
  const publicProject = createProjectFactory({
    name: 'MCDI Dashboard',
    description: 'Public dashboard for MicroClub',
    isInternal: false,
    redirectUri: 'http://localhost:3001/auth/callback',
  });

  // 4. Test project for development
  const testProject = createProjectFactory({
    name: 'Test Project',
    description: 'Test project for development',
    isInternal: false,
    redirectUri: 'http://localhost:4000/auth/callback',
  });

  const [insertedInternalProject, insertedExternalProject, insertedPublicProject, insertedTestProject] = await db
    .insert(schema.projects)
    .values([internalProject, externalProject, publicProject, testProject])
    .onConflictDoNothing()
    .returning();

  console.log('Linking projects to server...');
  const projectServersData: { projectId: string; serverId: string; operations: { READ: boolean; SEND_MESSAGES: boolean; MANAGE_WEBHOOKS: boolean } }[] = [];

  if (insertedInternalProject) {
    projectServersData.push({
      projectId: insertedInternalProject.id,
      serverId: serverId,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: true },
    });
  }

  if (insertedExternalProject) {
    projectServersData.push({
      projectId: insertedExternalProject.id,
      serverId: serverId,
      operations: { READ: true, SEND_MESSAGES: false, MANAGE_WEBHOOKS: false },
    });
  }

  if (insertedPublicProject) {
    projectServersData.push({
      projectId: insertedPublicProject.id,
      serverId: serverId,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: false },
    });
  }

  if (insertedTestProject) {
    projectServersData.push({
      projectId: insertedTestProject.id,
      serverId: serverId,
      operations: { READ: true, SEND_MESSAGES: true, MANAGE_WEBHOOKS: false },
    });
  }

  if (projectServersData.length > 0) {
    await db
      .insert(schema.projectServers)
      .values(projectServersData)
      .onConflictDoNothing();
  }

  console.log('Seeding project roles (access control)...');
  // External Dashboard requires Admin or Lead role
  if (insertedExternalProject && insertedRoles.length >= 2) {
    const projectRolesData = [
      createProjectRoleFactory(insertedExternalProject.id, insertedRoles[0].id), // Admin role
      createProjectRoleFactory(insertedExternalProject.id, insertedRoles[1].id), // Lead role
    ];

    await db
      .insert(schema.projectRoles)
      .values(projectRolesData)
      .onConflictDoNothing();

    console.log(`  - External Dashboard requires: ${insertedRoles[0].name} or ${insertedRoles[1].name} role`);
  }

  // Seed scopes for all inserted projects
  const allInsertedProjects = [insertedInternalProject, insertedExternalProject, insertedPublicProject, insertedTestProject].filter(Boolean);
  for (const proj of allInsertedProjects) {
    if (proj) {
      const scopesData = createAllScopesFactory(proj.id);
      await db
        .insert(schema.projectScopes)
        .values(scopesData)
        .onConflictDoNothing();
    }
  }

  console.log('Initial seeding completed!');
  console.log('\n=== TEST DATA SUMMARY ===');
  console.log(`Main Server ID: ${serverId}`);
  console.log(`Roles: ${insertedRoles.map(r => `${r.name} (${r.id})`).join(', ')}`);
  console.log(`Members: ${insertedMembers.length} total`);
  console.log(`  - Member 1: ${insertedMembers[0]?.id} (${insertedMembers[0]?.username}) - Admin role`);
  console.log(`  - Member 2: ${insertedMembers[1]?.id} (${insertedMembers[1]?.username}) - Lead role`);
  console.log(`  - Member 3: ${insertedMembers[2]?.id} (${insertedMembers[2]?.username}) - Member role`);
  console.log('\nProjects:');
  console.log(`  1. Internal: "${internalProject.name}" (Prefix: ${internalProject.apiKeyPrefix})`);
  console.log(`     - Uses main server automatically`);
  console.log(`     - No role restrictions`);
  console.log(`  2. External: "${externalProject.name}" (Prefix: ${externalProject.apiKeyPrefix})`);
  console.log(`     - Requires explicit serverId`);
  console.log(`     - Requires Admin OR Lead role`);
  console.log(`  3. Public: "${publicProject.name}" (Prefix: ${publicProject.apiKeyPrefix})`);
  console.log(`     - Requires explicit serverId`);
  console.log(`     - No role restrictions`);
  console.log(`  4. Test: "${testProject.name}" (Prefix: ${testProject.apiKeyPrefix})`);
  console.log(`     - Server: ${serverId}`);
  console.log(`     - No role restrictions`);
  console.log('========================\n');
}
