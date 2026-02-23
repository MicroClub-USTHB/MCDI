import { pgTable, uuid, varchar, timestamp, boolean, text } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';


export const oauthClients = pgTable('oauth_clients', {
    id: uuid('id').defaultRandom().primaryKey(),
    clientId: varchar('client_id', { length: 255 }).notNull().unique(),
    clientSecret: varchar('client_secret', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    redirectUris: text('redirect_uris').array().notNull(),
    active: boolean('active').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});