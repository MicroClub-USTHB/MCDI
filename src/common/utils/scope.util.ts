import { ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';

/**
 * Checks whether a project has a specific scope granted for a given server.
 * Scopes are now stored per project-server pair in the project_servers.scopes JSONB column.
 * Throws 403 if the scope is missing.
 */
export async function validateScope(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  serverId: string,
  requiredScope: string,
): Promise<void> {
  const [row] = await db
    .select({ scopes: schema.projectServers.scopes })
    .from(schema.projectServers)
    .where(
      and(
        eq(schema.projectServers.projectId, projectId),
        eq(schema.projectServers.serverId, serverId),
      ),
    )
    .limit(1);

  if (
    !row ||
    !Array.isArray(row.scopes) ||
    !row.scopes.includes(requiredScope)
  ) {
    throw new ForbiddenException(
      `Insufficient scope: '${requiredScope}' is required`,
    );
  }
}
