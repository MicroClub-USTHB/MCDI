// src/oauth/repositories/oauth-client.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateOAuthClientDto {
    clientId: string;
    clientSecret: string;
    name: string;
    redirectUris: string[];
    active?: boolean;
}

@Injectable()
export class OAuthClientRepository {
    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) { }

    async findByClientId(clientId: string) {
        const clients = await this.db
            .select()
            .from(schema.oauthClients)
            .where(eq(schema.oauthClients.clientId, clientId))
            .limit(1);

        return clients[0] || null;
    }

    async findByClientIdAndSecret(clientId: string, clientSecret: string) {
        const clients = await this.db
            .select()
            .from(schema.oauthClients)
            .where(
                and(
                    eq(schema.oauthClients.clientId, clientId),
                    eq(schema.oauthClients.clientSecret, clientSecret),
                ),
            )
            .limit(1);

        return clients[0] || null;
    }

    async findActiveByClientId(clientId: string) {
        const clients = await this.db
            .select()
            .from(schema.oauthClients)
            .where(
                and(
                    eq(schema.oauthClients.clientId, clientId),
                    eq(schema.oauthClients.active, true),
                ),
            )
            .limit(1);

        return clients[0] || null;
    }

    async create(data: CreateOAuthClientDto) {
        const clients = await this.db
            .insert(schema.oauthClients)
            .values({
                clientId: data.clientId,
                clientSecret: data.clientSecret,
                name: data.name,
                redirectUris: data.redirectUris,
                active: data.active ?? true,
            })
            .returning();

        return clients[0];
    }

    async update(clientId: string, data: Partial<CreateOAuthClientDto>) {
        const clients = await this.db
            .update(schema.oauthClients)
            .set({
                name: data.name,
                redirectUris: data.redirectUris,
                active: data.active,
            })
            .where(eq(schema.oauthClients.clientId, clientId))
            .returning();

        return clients[0] || null;
    }

    async delete(clientId: string) {
        await this.db
            .delete(schema.oauthClients)
            .where(eq(schema.oauthClients.clientId, clientId));
    }

    async findAll(limit: number = 100, offset: number = 0) {
        return this.db
            .select({
                id: schema.oauthClients.id,
                clientId: schema.oauthClients.clientId,
                name: schema.oauthClients.name,
                redirectUris: schema.oauthClients.redirectUris,
                active: schema.oauthClients.active,
                createdAt: schema.oauthClients.createdAt,
            })
            .from(schema.oauthClients)
            .limit(limit)
            .offset(offset);
    }

    async setActive(clientId: string, active: boolean) {
        const clients = await this.db
            .update(schema.oauthClients)
            .set({ active })
            .where(eq(schema.oauthClients.clientId, clientId))
            .returning();

        return clients[0] || null;
    }
}