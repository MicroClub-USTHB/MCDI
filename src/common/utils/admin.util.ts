import { ForbiddenException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';

/**
 * Checks whether a member holds the configured admin role ID in the main server.
 * Throws 403 if no main server is configured.
 * Returns false if the member is not in the main server or lacks the admin role.
 */
export async function isAdminMember(
  db: NodePgDatabase<typeof schema>,
  memberId: string,
  executiveRoleId: string,
): Promise<boolean> {
  if (!executiveRoleId) {
    throw new ForbiddenException('No executive role configured');
  }

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

  // 3. Get the member's role IDs in the main server
  const memberRoles = await db
    .select({ roleId: schema.roles.id })
    .from(schema.serverMemberRoles)
    .innerJoin(
      schema.roles,
      and(
        eq(schema.serverMemberRoles.roleId, schema.roles.id),
        eq(schema.roles.serverId, mainServer.id),
      ),
    )
    .where(eq(schema.serverMemberRoles.memberId, memberId));

  // 4. Check for the configured admin role ID
  return memberRoles.some((role) => role.roleId === executiveRoleId);
}
