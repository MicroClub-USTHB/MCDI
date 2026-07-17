import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import * as schema from '../entities';

/**
 * Admin accounts are now provisioned automatically via Discord OAuth2.
 *
 * Access is granted to any member of the main MCDI Discord server who holds the
 * "Executive" role — no seeded credentials needed.
 *
 * This seeder clears any legacy `is_system_admin` flags and `password_hash` values
 * that were set by the previous username/password auth system.
 */
export async function adminSeeder(db: NodePgDatabase<typeof schema>) {
  console.log(
    'Clearing legacy admin credentials (is_system_admin / password_hash)...',
  );

  await db
    .update(schema.members)
    .set({
      isSystemAdmin: false,
      passwordHash: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.members.isSystemAdmin, true));

  console.log(
    '  ✓ Legacy admin flags cleared. Admin access is now granted via Discord "Executive" role.',
  );
}
