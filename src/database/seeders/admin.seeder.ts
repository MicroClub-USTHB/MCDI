import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { hash } from 'bcryptjs';
import { eq } from 'drizzle-orm';
import * as schema from '../entities';

/**
 * Seeds the system admin member account.
 *
 * Default password: changeme  ← change immediately after first login.
 *
 * Re-running this seeder is safe:
 *  - Member fields are updated on conflict.
 *  - The password hash is only written when currently empty,
 *    so a previously-set password is never overwritten.
 */
export async function adminSeeder(db: NodePgDatabase<typeof schema>) {
  console.log('Seeding system admin member...');

  const ADMIN_ID = '1128450529710854185';
  const DEFAULT_PASSWORD = 'changeme';

  // ── 1. Upsert core member fields ─────────────────────────────────────────
  await db
    .insert(schema.members)
    .values({
      id: ADMIN_ID,
      username: 'ben_abdou5094',
      globalName: 'THE JOAT',
      displayName: null,
      avatar:
        'https://cdn.discordapp.com/avatars/1128450529710854185/1b7ba1c3200c303760a64e38d6bf42b1.webp',
      email: null,
      isClubMember: false,
      isSystemAdmin: true,
      joinedAt: new Date('2024-04-21T12:51:39.482Z'),
      syncedAt: new Date('2026-03-07T02:22:56.321Z'),
    })
    .onConflictDoUpdate({
      target: schema.members.id,
      set: {
        username: 'ben_abdou5094',
        globalName: 'THE JOAT',
        isSystemAdmin: true,
        updatedAt: new Date(),
      },
    });

  // ── 2. Set default password only if no hash is stored yet ────────────────
  const [row] = await db
    .select({ passwordHash: schema.members.passwordHash })
    .from(schema.members)
    .where(eq(schema.members.id, ADMIN_ID))
    .limit(1);

  if (!row?.passwordHash) {
    const passwordHash = await hash(DEFAULT_PASSWORD, 12);
    await db
      .update(schema.members)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(schema.members.id, ADMIN_ID));
    console.log(
      `  ⚠️  Default password set to "${DEFAULT_PASSWORD}" — change it immediately!`,
    );
  } else {
    console.log('  ✓ Existing password preserved.');
  }

  console.log(
    '  ✓ System admin seeded (id: 1128450529710854185, username: ben_abdou5094).',
  );
}
