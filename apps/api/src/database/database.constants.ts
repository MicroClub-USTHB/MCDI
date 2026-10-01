import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './entities';

export const DRIZZLE = 'DRIZZLE';
export const DATABASE_POOL = 'DATABASE_POOL';
export type DrizzleDB = NodePgDatabase<typeof schema>;
