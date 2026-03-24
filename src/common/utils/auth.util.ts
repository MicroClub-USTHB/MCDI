import { UnauthorizedException } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Request } from 'express';
import * as schema from '../../database/entities';
import { getSessionTokenCandidates } from './session-token.util';

/**
 * Extracts the Bearer token from the Authorization header.
 * Used by SystemAdminGuard for session token extraction.
 *
 * @example
 * Authorization: Bearer <token>  →  "<token>"
 */
export function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

/**
 * Extracts an API key from the request.
 * Checks in order:
 *   1. Authorization: Bearer <key>
 *   2. X-API-Key header
 *   3. ?apiKey= query param
 *
 * Used by ApiKeyGuard.
 */
export function extractApiKey(request: Request): string | null {
  const bearer = extractBearerToken(request);
  if (bearer) return bearer;

  const apiKey = request.headers['x-api-key'] || request.query.apiKey;
  return typeof apiKey === 'string' ? apiKey : null;
}

/**
 * Validates a session token against the sessions table.
 * Throws 401 if the token is not found or has expired.
 * Returns the memberId on success.
 */
export async function validateSession(
  db: NodePgDatabase<typeof schema>,
  token: string,
): Promise<string> {
  const [session] = await db
    .select({
      memberId: schema.sessions.memberId,
      expiresAt: schema.sessions.expiresAt,
    })
    .from(schema.sessions)
    .where(inArray(schema.sessions.token, getSessionTokenCandidates(token)))
    .limit(1);

  if (!session) {
    throw new UnauthorizedException('Invalid or expired session');
  }

  if (session.expiresAt < new Date()) {
    throw new UnauthorizedException('Session has expired');
  }

  return session.memberId;
}
