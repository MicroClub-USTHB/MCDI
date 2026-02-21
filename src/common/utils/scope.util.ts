import { ForbiddenException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/entities';

/**
 * Checks whether a project has a specific scope granted.
 * Throws 403 if the scope is missing.
 */
export async function validateScope(
  db: NodePgDatabase<typeof schema>,
  projectId: string,
  requiredScope: string,
): Promise<void> {
  const [scope] = await db
    .select()
    .from(schema.projectScopes)
    .where(
      and(
        eq(schema.projectScopes.projectId, projectId),
        eq(schema.projectScopes.scope, requiredScope),
      ),
    )
    .limit(1);

  if (!scope) {
    throw new ForbiddenException(
      `Insufficient scope: '${requiredScope}' is required`,
    );
  }
}
