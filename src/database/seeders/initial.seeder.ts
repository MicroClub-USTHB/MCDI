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
    apiKey: 'mcdi-internal-events-2024',
    isInternal: true,
    redirectUri: 'http://localhost:4000/auth/callback',
  });
  
  // 2. External project (External Dashboard) - requires Lead or Admin role
  const externalProject = createProjectFactory({
    name: 'External Dashboard',
    description: 'External client dashboard with role restrictions',
    apiKey: 'mcdi-external-dashboard-2024',
    isInternal: false,
    redirectUri: 'http://localhost:5000/auth/callback',
  });
  
  // 3. Public project (MCDI Dashboard) - no role restrictions
  const publicProject = createProjectFactory({
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

  console.log('Seeding project...');
  const projectData = createProjectFactory({
    name: 'MCDI Dashboard',
    description: 'Internal dashboard for managing MCDI',
    apiKey: 'mcdi-dashboard-2024',
    isInternal: false,
    redirectUri: 'http://localhost:3001/auth/callback',
  });

  // 4. Test project for development
  const testProject = createProjectFactory({
    name: 'Test Project',
    description: 'Test project for development',
    apiKey: 'mcdi-proj-test123456789',
    isInternal: false,
    redirectUri: 'http://localhost:4000/auth/callback',
  });

  const [insertedInternalProject, insertedExternalProject, insertedPublicProject, insertedTestProject] = await db
    .insert(schema.projects)
    .values([internalProject, externalProject, publicProject, testProject])
    .onConflictDoNothing()
    .returning();

  console.log('Linking projects to server...');
  const projectServersData: { projectId: string; serverId: string; operations: Record<string, boolean> }[] = [];
  
  if (insertedInternalProject) {
    projectServersData.push({
      projectId: insertedInternalProject.id,
      serverId: serverId,
      operations: { read: true, write: true, manage_members: true },
    });
  }
  
  if (insertedExternalProject) {
    projectServersData.push({
      projectId: insertedExternalProject.id,
      serverId: serverId,
      operations: { read: true, write: false, manage_members: false },
    });
  }
  
  if (insertedPublicProject) {
    projectServersData.push({
      projectId: insertedPublicProject.id,
      serverId: serverId,
      operations: { read: true, write: true, manage_members: false },
    });
  }

  if (insertedTestProject) {
    projectServersData.push({
      projectId: insertedTestProject.id,
      serverId: serverId,
      operations: { read: true, write: true, manage_members: false },
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
  console.log('\n=== TEST DATA SUMMARY ===');
  console.log(`Main Server ID: ${serverId}`);
  console.log(`Roles: ${insertedRoles.map(r => `${r.name} (${r.id})`).join(', ')}`);
  console.log(`Members: ${insertedMembers.length} total`);
  console.log(`  - Member 1: ${insertedMembers[0]?.id} (${insertedMembers[0]?.username}) - Admin role`);
  console.log(`  - Member 2: ${insertedMembers[1]?.id} (${insertedMembers[1]?.username}) - Lead role`);
  console.log(`  - Member 3: ${insertedMembers[2]?.id} (${insertedMembers[2]?.username}) - Member role`);
  console.log('\nProjects:');
  console.log(`  1. Internal: "${internalProject.name}" (API Key: ${internalProject.apiKey})`);
  console.log(`     - Uses main server automatically`);
  console.log(`     - No role restrictions`);
  console.log(`  2. External: "${externalProject.name}" (API Key: ${externalProject.apiKey})`);
  console.log(`     - Requires explicit serverId`);
  console.log(`     - Requires Admin OR Lead role`);
  console.log(`  3. Public: "${publicProject.name}" (API Key: ${publicProject.apiKey})`);
  console.log(`     - Requires explicit serverId`);
  console.log(`     - No role restrictions`);
  console.log(`  4. Test: "${testProject.name}" (API Key: ${testProject.apiKey})`);
  console.log(`     - Server: ${serverId}`);
  console.log(`     - No role restrictions`);
  console.log('========================\n');
}
