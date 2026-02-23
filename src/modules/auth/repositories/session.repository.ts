import { Injectable, Inject } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and, lt, gt } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/database.module';
import * as schema from '../../../database/entities';

export interface CreateSessionDto {
    memberId: string;
    projectId?: string;
    serverId?: string;
    token: string;
    expiresAt: Date;
}

@Injectable()
export class SessionRepository {
    constructor(
        @Inject(DRIZZLE) private db: NodePgDatabase<typeof schema>,
    ) { }

    async findById(id: string) {
        const sessions = await this.db
            .select()
            .from(schema.sessions)
            .where(eq(schema.sessions.id, id))
            .limit(1);

        return sessions[0] || null;
    }

    async findByToken(token: string) {
        const sessions = await this.db
            .select()
            .from(schema.sessions)
            .where(eq(schema.sessions.token, token))
            .limit(1);

        return sessions[0] || null;
    }

    async findByTokenWithMember(token: string) {
        const sessions = await this.db
            .select({
                session: schema.sessions,
                member: schema.members,
            })
            .from(schema.sessions)
            .leftJoin(schema.members, eq(schema.sessions.memberId, schema.members.id))
            .where(eq(schema.sessions.token, token))
            .limit(1);

        if (sessions.length === 0) {
            return null;
        }

        return {
            ...sessions[0].session,
            member: sessions[0].member,
        };
    }

    async findByMemberId(memberId: string, limit: number = 100) {
        return this.db
            .select()
            .from(schema.sessions)
            .where(eq(schema.sessions.memberId, memberId))
            .limit(limit);
    }

    async findValidByToken(token: string) {
        const now = new Date();
        const sessions = await this.db
            .select()
            .from(schema.sessions)
            .where(
                and(
                    eq(schema.sessions.token, token),
                    gt(schema.sessions.expiresAt, now),
                ),
            )
            .limit(1);

        return sessions[0] || null;
    }

    async create(data: CreateSessionDto) {
        const sessions = await this.db
            .insert(schema.sessions)
            .values({
                memberId: data.memberId,
                projectId: data.projectId,
                serverId: data.serverId,
                token: data.token,
                expiresAt: data.expiresAt,
            })
            .returning();

        return sessions[0];
    }

    async deleteById(id: string) {
        await this.db
            .delete(schema.sessions)
            .where(eq(schema.sessions.id, id));
    }

    async deleteByToken(token: string) {
        await this.db
            .delete(schema.sessions)
            .where(eq(schema.sessions.token, token));
    }

    async deleteByMemberId(memberId: string) {
        await this.db
            .delete(schema.sessions)
            .where(eq(schema.sessions.memberId, memberId));
    }

    async deleteExpired() {
        const now = new Date();
        await this.db
            .delete(schema.sessions)
            .where(lt(schema.sessions.expiresAt, now));
    }

    async updateExpiration(token: string, expiresAt: Date) {
        const sessions = await this.db
            .update(schema.sessions)
            .set({ expiresAt })
            .where(eq(schema.sessions.token, token))
            .returning();

        return sessions[0] || null;
    }
}
