import { createHmac, randomBytes } from 'crypto';
import { timingSafeEqualHex } from './crypto.util';

/**
 * HMAC request signing for inbound webhooks.
 *
 *   X-MCDI-Signature: t=<unix seconds>,v1=<hex hmac-sha256>
 *
 * The signed string is `"<t>.<raw request body>"`.
 *
 * Verify against the RAW body, never JSON.stringify(req.body) — key order and
 * whitespace do not survive the parse/serialize round trip, and every
 * signature will fail.
 */

export const SIGNATURE_HEADER = 'x-mcdi-signature';
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type ParsedSignature = { timestamp: number; signature: string };

export type SignatureFailure =
  'MALFORMED_HEADER' | 'STALE_TIMESTAMP' | 'SIGNATURE_MISMATCH';

export type VerifyResult =
  | { ok: true; parsed: ParsedSignature }
  | { ok: false; reason: SignatureFailure };

export function generateSigningSecret(): string {
  return `whsec_${randomBytes(32).toString('hex')}`;
}

export function computeSignature(
  secret: string,
  timestamp: number,
  rawBody: string | Buffer,
): string {
  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');
}

export function signPayload(
  secret: string,
  rawBody: string | Buffer,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  return `t=${timestamp},v1=${computeSignature(secret, timestamp, rawBody)}`;
}

export function parseSignatureHeader(header: string): ParsedSignature | null {
  if (typeof header !== 'string' || header.length === 0) return null;

  let timestamp: number | null = null;
  let signature: string | null = null;

  for (const part of header.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      if (!/^\d+$/.test(value)) return null;
      timestamp = Number(value);
    } else if (key === 'v1') {
      if (!/^[0-9a-f]+$/i.test(value)) return null;
      signature = value.toLowerCase();
    }
  }

  if (timestamp === null || signature === null) return null;
  return { timestamp, signature };
}

export function verifySignature(params: {
  header: string | undefined;
  secret: string;
  rawBody: string | Buffer;
  toleranceSeconds?: number;
  now?: Date;
}): VerifyResult {
  const { header, secret, rawBody } = params;
  const tolerance = params.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;

  if (!header) return { ok: false, reason: 'MALFORMED_HEADER' };

  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'MALFORMED_HEADER' };

  const nowSeconds = Math.floor((params.now ?? new Date()).getTime() / 1000);
  if (Math.abs(nowSeconds - parsed.timestamp) > tolerance) {
    return { ok: false, reason: 'STALE_TIMESTAMP' };
  }

  const expected = computeSignature(secret, parsed.timestamp, rawBody);
  if (!timingSafeEqualHex(expected, parsed.signature)) {
    return { ok: false, reason: 'SIGNATURE_MISMATCH' };
  }

  return { ok: true, parsed };
}
