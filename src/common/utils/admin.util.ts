import { ForbiddenException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';

/** Discord role names that grant admin access to MCDI */
export const ADMIN_ROLES = ['Executive', 'Lead'] as const;

/**
 * Checks whether a member holds a Lead or Executive role in the main server.
 * Throws 403 if no main server is configured.
 * Returns false if the member is not in the main server or lacks an admin role.
 */
export async function isAdminMember(
  db: NodePgDatabase<typeof schema>,
  memberId: string,
): Promise<boolean> {
  // 1. Find the configured main server
  const [mainServer] = await db
    .select({ id: schema.servers.id })
    .from(schema.servers)
    .where(eq(schema.servers.isMain, true))
    .limit(1);

  if (!mainServer) {
    throw new ForbiddenException('No main server configured');
  }

  // 2. Confirm member belongs to the main server
  const [membership] = await db
    .select({ memberId: schema.serverMembers.memberId })
    .from(schema.serverMembers)
    .where(
      and(
        eq(schema.serverMembers.serverId, mainServer.id),
        eq(schema.serverMembers.memberId, memberId),
      ),
    )
    .limit(1);

  if (!membership) return false;

  // 3. Get the member's role names in the main server
  const memberRoles = await db
    .select({ name: schema.roles.name })
    .from(schema.serverMemberRoles)
    .innerJoin(
      schema.roles,
      and(
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
        eq(schema.roles.serverId, mainServer.id),
      ),
    )
    .where(eq(schema.serverMemberRoles.memberId, memberId));

  // 4. Check for Lead or Executive
  const roleNames = memberRoles.map((r) => r.name);
  return ADMIN_ROLES.some((adminRole) => roleNames.includes(adminRole));
}
