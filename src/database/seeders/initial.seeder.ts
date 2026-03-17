import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../entities';
import { createMemberFactory } from '../factories/member.factory';
import { createServerFactory } from '../factories/server.factory';
import { createProjectFactory } from '../factories/project.factory';
import { createAllScopesFactory } from '../factories/project-scope.factory';
import { createRoleFactory } from '../factories/role.factory';
import { createSessionFactory } from '../factories/session.factory';

export async function initialSeeder(db: NodePgDatabase<typeof schema>) {
  console.log('Seeding initial data...');

  console.log('Seeding permissions...');
  const permissionsData = [
    {
      name: 'Administrator',
      code: 'ADMINISTRATOR',
      description: 'Full access to the discord server',
      bitfield: BigInt(0x8),
    },
    {
      name: 'Manage Channels',
      code: 'MANAGE_CHANNELS',
      description: 'Can add/remove/edit channels',
      bitfield: BigInt(0x10),
    },
    {
      name: 'View Audit Log',
      code: 'VIEW_AUDIT_LOG',
      description: 'Can view server audit logs',
      bitfield: BigInt(0x80),
    },
    {
      name: 'Manage Roles',
      code: 'MANAGE_ROLES',
      description: 'Can create and edit roles',
      bitfield: BigInt(0x10000000),
    },
  ];

  const insertedPermissions = await db
    .insert(schema.permissions)
    .values(permissionsData)
    .onConflictDoNothing()
    .returning();

  console.log('  - Seeding main server...');
  const mainServer = createServerFactory({
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
    createRoleFactory(serverId, { name: 'Executive', position: 1 }),
    createRoleFactory(serverId, { name: 'Lead', position: 2 }),
    createRoleFactory(serverId, { name: 'Member', position: 3 }),
  ];
  const insertedRoles = await db
    .insert(schema.roles)
    .values(rolesData)
    .onConflictDoNothing()
    .returning();

  console.log('Seeding role permissions...');
  if (insertedRoles.length > 0 && insertedPermissions.length > 0) {
    const executiveRole = insertedRoles.find((r) => r.name === 'Executive');
    if (executiveRole) {
      const rolePermissionsData = insertedPermissions.map((p) => ({
        roleId: executiveRole.id,
        permissionId: p.id,
      }));
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
  }

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
  }

  console.log('Seeding project...');
  const projectData = createProjectFactory({
    name: 'MCDI Dashboard',
    description: 'Internal dashboard for managing MCDI',
  });
  const [insertedProject] = await db
    .insert(schema.projects)
    .values(projectData)
    .onConflictDoNothing()
    .returning();

  if (insertedProject) {
    console.log('  - Seeding project scopes...');
    const scopesData = createAllScopesFactory(insertedProject.id);
    await db
      .insert(schema.projectScopes)
      .values(scopesData)
      .onConflictDoNothing();

    console.log('  - Linking project to server...');
    await db
      .insert(schema.projectServers)
      .values({
        projectId: insertedProject.id,
        serverId: serverId,
        operations: {
          READ: true,
          SEND_MESSAGES: true,
          MANAGE_WEBHOOKS: true,
        },
      })
      .onConflictDoNothing();

    console.log(`  - Project API key prefix: ${projectData.apiKeyPrefix}`);
    console.log(
      '    (Full key is not stored — regenerate via admin endpoint if needed)',
    );
  }

  console.log('Initial seeding completed!');
}
