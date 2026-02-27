import 'dotenv/config';
import { Pool } from 'pg';

async function main() {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not defined in environment variables');
    }

    const pool = new Pool({
        connectionString: databaseUrl,
    });

    try {
        console.log('Clearing database tables...');

        // We use a raw query to extract public schema tables and TRUNCATE them WITH CASCADE
        // We explicitly exclude Drizzle's internal migration tables if any exist
        await pool.query(`
      DO $$ DECLARE
          r RECORD;
      BEGIN
          FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename NOT LIKE '%drizzle%') LOOP
              EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE;';
          END LOOP;
      END $$;
    `);

        console.log('✅ All tables successfully cleared!');
    } catch (error) {
        console.error('❌ Clearing database failed:');
        console.error(error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
