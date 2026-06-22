import { Request } from 'express';

export interface ClientInfo {
  ipAddress: string | null;
  userAgent: string | null;
}

// Prefers the first X-Forwarded-For hop (real client behind a proxy), falling
// back to the socket address. Mirrors the audit middleware's IP extraction.
export function extractClientInfo(req: Request): ClientInfo {
  const forwarded = req.headers['x-forwarded-for'];
  const ipAddress =
    typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : (req.ip ?? null);

  return {
    ipAddress,
    userAgent: req.headers['user-agent'] ?? null,
  };
}
