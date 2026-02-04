import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../entities';
import { createMemberFactory } from '../factories/member.factory';
import { createServerFactory } from '../factories/server.factory';
import { createProjectFactory } from '../factories/project.factory';
import { createRoleFactory } from '../factories/role.factory';

export async function initialSeeder(db: NodePgDatabase<typeof schema>) {
  console.log('Seeding initial data...');

  console.log('Seeding permissions...');
  const permissionsData = [
    { name: 'Admin', code: 'ADMIN', description: 'Full access to the system' },
    {
      name: 'Manage Members',
      code: 'MEMBER_MANAGE',
      description: 'Can add/remove/edit members',
    },
    {
      name: 'View Members',
      code: 'MEMBER_VIEW',
      description: 'Can list and view members',
    },
    {
      name: 'Manage Projects',
      code: 'PROJECT_MANAGE',
      description: 'Can create and edit projects',
    },
  ];

  await db
    .insert(schema.permissions)
    .values(permissionsData)
    .onConflictDoNothing();

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
    createRoleFactory(serverId, { name: 'Admin', position: 1 }),
    createRoleFactory(serverId, { name: 'Lead', position: 2 }),
    createRoleFactory(serverId, { name: 'Member', position: 3 }),
  ];
  await db.insert(schema.roles).values(rolesData).onConflictDoNothing();

  console.log('Seeding members...');
  const membersData = Array.from({ length: 10 }).map(() =>
    createMemberFactory(),
  );
  await db.insert(schema.members).values(membersData).onConflictDoNothing();

  console.log('Seeding project...');
  const projectData = createProjectFactory({
    name: 'MCDI Dashboard',
    description: 'Internal dashboard for managing MCDI',
  });
  await db.insert(schema.projects).values(projectData).onConflictDoNothing();

  console.log('Initial seeding completed!');
}
