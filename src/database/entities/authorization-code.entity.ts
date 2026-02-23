import { pgTable, uuid, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { members } from './member.entity';
import { projects } from './project.entity';

export const authorizationCodes = pgTable('authorization_codes', {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 255 }).notNull().unique(),
    userId: varchar('user_id', { length: 255 }).notNull().references(() => members.id),
    /** The project (platform) this auth code was issued for */
    projectId: uuid('project_id').references(() => projects.id),
    /** The Discord server ID verified against */
    serverId: varchar('server_id', { length: 255 }),
    clientId: varchar('client_id', { length: 255 }).notNull(),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    used: boolean('used').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});
