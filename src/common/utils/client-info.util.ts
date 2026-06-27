import { Request } from 'express';

export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

// client_ip_address is VARCHAR(45) (max IPv6 length); user_agent is TEXT but
// still capped so an oversized client-supplied header cannot fail the session
// insert or bloat the row.
const MAX_IP_LENGTH = 45;
const MAX_USER_AGENT_LENGTH = 512;

// Prefers the first X-Forwarded-For hop (real client behind a proxy), falling
// back to the socket address. Mirrors the audit middleware's IP extraction.
export function extractClientInfo(req: Request): ClientInfo {
  const forwarded = req.headers['x-forwarded-for'];
  let ipAddress =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? null);

  // Anything longer than a valid IP is malformed; drop it rather than let it
  // overflow the column and fail the insert.
  if (ipAddress && ipAddress.length > MAX_IP_LENGTH) {
    ipAddress = null;
  }

  const userAgent = req.headers['user-agent'];

  return {
    ipAddress,
    userAgent:
      typeof userAgent === 'string'
        ? userAgent.slice(0, MAX_USER_AGENT_LENGTH)
        : null,
  };
}
