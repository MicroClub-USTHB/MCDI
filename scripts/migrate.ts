import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[migrate] DATABASE_URL is not set');
  process.exit(1);
}

const migrationsFolder = resolve(process.cwd(), 'src/database/migrations');

// When RESET_DB=1 we drop and recreate the target database before applying.
// This guarantees every retry starts from a clean schema, sidestepping the
// "drizzle-kit re-applies a half-finished migration -> already exists" trap.
async function resetDatabase(): Promise<void> {
  const maintenanceUrl = connectionString.replace(/\/[^/?]+(\?.*)?$/, '/postgres');
  const pool = new Pool({ connectionString: maintenanceUrl, max: 1 });
  try {
    const dbName = connectionString.match(/\/([^/?]+)(\?.*)?$/)?.[1] ?? 'mcdi_test';
    console.log(`[migrate] resetting database "${dbName}"`);
    await pool.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await pool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
    await pool.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await pool.end();
  }
}

async function run(): Promise<void> {
  if (process.env.RESET_DB === '1') {
    await resetDatabase();
  }

  const pool = new Pool({ connectionString, max: 1 });
  const db = drizzle(pool);
  try {
    console.log(`[migrate] applying migrations from ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('[migrate] migrations applied successfully');
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] FAILED:');
  console.error(err);
  process.exit(1);
});
