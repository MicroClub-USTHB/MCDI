/**
 * E2E database utilities.
 *
 * Connects directly to the database via `DATABASE_URL` so tests can seed/clear
 * data independently of the NestJS application bootstrap.
 *
 * Usage pattern:
 *   const db = getTestDb();
 *   afterAll(() => closeTestDb());
 *   beforeEach(() => clearAllTables(db));
 */
import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/database/entities';
import { createHash, randomBytes } from 'crypto';

export type TestDb = NodePgDatabase<typeof schema>;

let pool: Pool | undefined;

/** Returns a shared Drizzle instance connected to `DATABASE_URL`. */
export function getTestDb(): TestDb {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required for E2E tests');
    pool = new Pool({ connectionString: url });
  }
  return drizzle(pool, { schema });
}

/** Closes the shared pool. Call in `afterAll`. */
export async function closeTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

/**
 * Truncates every table in the public schema (except Drizzle migration tables).
 * Fast: single SQL statement with CASCADE.
 */
export async function clearAllTables(db: TestDb): Promise<void> {
  await (db as any).execute(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = current_schema()
          AND tablename NOT LIKE '%drizzle%'
      ) LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE;';
      END LOOP;
    END $$;
  `);
}

// ─── Fixture factories ──────────────────────────────────────────────────────

export interface AdminContext {
  /** Bearer token to pass as `Authorization: Bearer <token>` */
  bearerToken: string;
  memberId: string;
  serverId: string;
  roleId: string;
}

/**
 * Seeds the minimum data required for `SystemAdminGuard` to pass:
 *   main server → member → server membership → Executive role → session
 *
 * Returns auth context containing the bearer token and key IDs.
 */
export async function seedAdminContext(db: TestDb): Promise<AdminContext> {
  const serverId = '900000000000000001';
  const memberId = '800000000000000001';
  const roleId = '700000000000000001';
  const token = randomBytes(32).toString('hex');

  // 1. Main server
  await db.insert(schema.servers).values({
    id: serverId,
    name: 'Test Main Server',
    icon: null,
    isMain: true,
    isActive: true,
    type: 'club',
    syncedAt: new Date(),
  });

  // 2. Member
  await db.insert(schema.members).values({
    id: memberId,
    username: 'testadmin',
    globalName: 'Test Admin',
    displayName: 'Test Admin',
    avatar: null,
    email: 'admin@test.com',
    isClubMember: true,
    joinedAt: new Date(),
    syncedAt: new Date(),
  });

  // 3. Server membership
  await db.insert(schema.serverMembers).values({
    serverId,
    memberId,
    joinedAt: new Date(),
  });

  // 4. Executive role in the main server
  await db.insert(schema.roles).values({
    id: roleId,
    serverId,
    name: 'Executive',
    color: 0xffd700,
    hoist: true,
    position: 1,
    managed: false,
    mentionable: true,
  });

  // 5. Assign role to member
  await db.insert(schema.serverMemberRoles).values({ memberId, roleId });

  // 6. Active session
  await db.insert(schema.sessions).values({
    id: crypto.randomUUID(),
    memberId,
    token,
    expiresAt: new Date(Date.now() + 86_400_000), // +1 day
  });

  return { bearerToken: token, memberId, serverId, roleId };
}

export interface ProjectFixture {
  id: string;
  /** Plaintext API key: `<prefix>.<secret>` — pass to `?api_key=` */
  apiKey: string;
  prefix: string;
  hash: string;
}

/**
 * Inserts a test project and returns a usable plaintext API key.
 *
 * The auth service compares `SHA-256(secret)` against `apiKeyHash` in the DB.
 * Pass `scopes` to grant per-server scopes in the project_servers row.
 */
export async function seedTestProject(
  db: TestDb,
  serverId: string,
  overrides: Partial<{
    name: string;
    isInternal: boolean;
    isActive: boolean;
    redirectUri: string | null;
    /** Scopes granted for this project on the given server. */
    scopes: string[];
  }> = {},
): Promise<ProjectFixture> {
  const id = crypto.randomUUID();
  const prefixId = randomBytes(4).toString('hex');
  const secret = randomBytes(16).toString('hex');
  const prefix = `mcdi_pk_test_${prefixId}`;
  const hash = createHash('sha256').update(secret).digest('hex');
  const apiKey = `${prefix}.${secret}`;

  await db.insert(schema.projects).values({
    id,
    name: overrides.name ?? 'Test Project',
    description: 'E2E test project',
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    apiKeyCreatedAt: new Date(),
    webhookUrl: null,
    isInternal: overrides.isInternal ?? false,
    redirectUri: overrides.redirectUri ?? 'http://localhost:4000/callback',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: overrides.isActive ?? true,
  });

  // Link the project to the given server with optional scopes
  await db.insert(schema.projectServers).values({
    projectId: id,
    serverId,
    scopes: overrides.scopes ?? [],
  });

  return { id, apiKey, prefix, hash };
}

export interface MemberFixture {
  id: string;
  roleId: string;
}

/**
 * Seeds a member with a role inside a server and returns their IDs.
 * Useful for members / permissions e2e tests.
 */
export async function seedMemberWithRole(
  db: TestDb,
  serverId: string,
  overrides: Partial<{
    memberId: string;
    username: string;
    isClubMember: boolean;
  }> = {},
): Promise<MemberFixture> {
  // Generate unique 18-digit numeric IDs (Discord-like snowflakes)
  const ts = Date.now();
  const rand1 = randomBytes(2).readUInt16BE(0); // 0–65535
  const rand2 = randomBytes(2).readUInt16BE(0) + 1; // ensure different from rand1
  const memberId =
    overrides.memberId ?? `${ts}${String(rand1).padStart(5, '0')}`.slice(0, 18);
  const roleId = `${ts}${String(rand2).padStart(5, '0')}`.slice(0, 18);

  await db.insert(schema.members).values({
    id: memberId,
    username: overrides.username ?? `member_${memberId}`,
    globalName: null,
    displayName: null,
    avatar: null,
    isClubMember: overrides.isClubMember ?? true,
    joinedAt: new Date(),
    syncedAt: new Date(),
  });

  await db.insert(schema.serverMembers).values({
    serverId,
    memberId,
    joinedAt: new Date(),
  });

  await db.insert(schema.roles).values({
    id: roleId,
    serverId,
    name: `TestRole_${roleId}`,
    color: 0xaaaaaa,
    hoist: false,
    position: 1,
    managed: false,
    mentionable: false,
  });

  await db.insert(schema.serverMemberRoles).values({ memberId, roleId });

  return { id: memberId, roleId };
}
