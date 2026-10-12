import { CliError, ExitCode } from './errors.js';
import type { Session } from './session.js';

/**
 * Thin client for the MCDI admin auth endpoints (see the Admin API reference).
 * `baseUrl` is the MCDI origin without the `/api` prefix, as stored in profiles.
 */

const REQUEST_TIMEOUT_MS = 15_000;

export interface AdminMe {
  id: string;
  username: string;
  globalName: string | null;
  displayName: string | null;
  preferredName: string | null;
  sessionExpiresAt: string;
}

async function request(baseUrl: string, path: string, init: RequestInit = {}): Promise<Response> {
  const url = `${baseUrl}/api${path}`;
  try {
    // Never follow a redirect: it could carry the session token or a login code elsewhere.
    return await fetch(url, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new CliError(`could not reach MCDI at ${baseUrl} (${reason})`, ExitCode.Unexpected);
  }
}

async function readJson(res: Response, what: string): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    throw new CliError(
      `MCDI returned a non-JSON response for ${what} (HTTP ${res.status})`,
      ExitCode.Unexpected,
    );
  }
}

/** The query that starts a CLI login (loopback redirect + PKCE S256). Exported for tests. */
export function adminLoginQuery(redirectUri: string, codeChallenge: string): URLSearchParams {
  return new URLSearchParams({
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
}

/**
 * GET /auth/admin/discord → the Discord consent URL. With `redirect_uri` and a
 * PKCE challenge, MCDI hands the result back to the CLI's loopback listener as
 * a one-time code (MCDI's CLI login, mcdi-cli issue #2).
 */
export async function getAdminLoginUrl(
  baseUrl: string,
  redirectUri: string,
  codeChallenge: string,
): Promise<string> {
  const res = await request(
    baseUrl,
    `/auth/admin/discord?${adminLoginQuery(redirectUri, codeChallenge)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );
  if (!res.ok) {
    throw new CliError(`MCDI refused to start the login (HTTP ${res.status})`, ExitCode.Unexpected);
  }
  const body = (await readJson(res, 'the login URL')) as { url?: unknown } | null;
  if (typeof body?.url !== 'string') {
    throw new CliError('MCDI login response is missing the Discord URL', ExitCode.Unexpected);
  }
  return body.url;
}

export interface AdminLoginSession {
  token: string;
  expiresAt: string;
}

/** Validates the shape of a successful POST /auth/admin/token body. Exported for tests. */
export function parseAdminLoginSession(body: unknown): AdminLoginSession {
  const b = body as Partial<AdminLoginSession> | null;
  if (typeof b?.token !== 'string' || b.token === '' || typeof b.expiresAt !== 'string') {
    throw new CliError('MCDI login token response has an unexpected shape', ExitCode.Unexpected);
  }
  return { token: b.token, expiresAt: b.expiresAt };
}

/**
 * POST /auth/admin/token → the admin session, in exchange for the one-time
 * code from the loopback redirect and the PKCE verifier that started the login.
 */
export async function exchangeAdminLoginCode(
  baseUrl: string,
  code: string,
  codeVerifier: string,
): Promise<AdminLoginSession> {
  const res = await request(baseUrl, '/auth/admin/token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier }),
  });
  if (res.status === 401) {
    throw new CliError(
      'MCDI rejected the login code (expired, already used, or not from this login); run `mcdi-cli login` again',
      ExitCode.Auth,
    );
  }
  if (res.status === 429) {
    throw new CliError(
      'MCDI is rate-limiting login attempts; wait a minute and try again',
      ExitCode.Unexpected,
    );
  }
  if (!res.ok) {
    throw new CliError(
      `MCDI returned HTTP ${res.status} for the login code exchange`,
      ExitCode.Unexpected,
    );
  }
  return parseAdminLoginSession(await readJson(res, 'the login token'));
}

export interface AdminMeResponse {
  status: number;
  body: unknown;
}

/**
 * The raw GET /auth/admin/me request, for callers (e.g. `whoami --json`) that
 * need the exact body MCDI sent and their own 401/403 messages. A 401/403 body
 * is not read (it may not even be JSON behind a proxy); any other non-2xx
 * status is an unexpected error.
 */
export async function getAdminMeRaw(baseUrl: string, token: string): Promise<AdminMeResponse> {
  const res = await request(baseUrl, '/auth/admin/me', {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return { status: res.status, body: undefined };
  if (!res.ok) {
    throw new CliError(
      `MCDI returned HTTP ${res.status} for the admin profile`,
      ExitCode.Unexpected,
    );
  }
  return { status: res.status, body: await readJson(res, 'the admin profile') };
}

/** Validates the shape of a successful /auth/admin/me body. */
export function parseAdminMe(body: unknown): AdminMe {
  const me = body as Partial<AdminMe> | null;
  if (
    typeof me?.id !== 'string' ||
    typeof me.username !== 'string' ||
    typeof me.sessionExpiresAt !== 'string'
  ) {
    throw new CliError('MCDI admin profile response has an unexpected shape', ExitCode.Unexpected);
  }
  return me as AdminMe;
}

/** GET /auth/admin/me → the admin behind a session token. */
export async function getAdminMe(baseUrl: string, token: string): Promise<AdminMe> {
  const { status, body } = await getAdminMeRaw(baseUrl, token);
  if (status === 401) {
    throw new CliError('MCDI rejected the session token (invalid or expired)', ExitCode.Auth);
  }
  if (status === 403) {
    throw new CliError(
      'this Discord account is not a system admin on this MCDI instance',
      ExitCode.Auth,
    );
  }
  return parseAdminMe(body);
}

export function adminDisplayName(me: AdminMe): string {
  return me.preferredName || me.displayName || me.globalName || me.username;
}

/**
 * POST /auth/admin/logout → invalidates the session server-side. Returns the
 * raw status for 2xx/401/403 without reading the body (same reasoning as
 * getAdminMeRaw: a 401/403 body may not even be JSON behind a proxy); any
 * other non-2xx status is unexpected.
 */
export async function postAdminLogout(baseUrl: string, token: string): Promise<number> {
  const res = await request(baseUrl, '/auth/admin/logout', {
    method: 'POST',
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 || res.status === 403) return res.status;
  if (!res.ok) {
    throw new CliError(`MCDI returned HTTP ${res.status} for logout`, ExitCode.Unexpected);
  }
  return res.status;
}

/**
 * An inbound webhook as `/admin/inbound-webhooks` returns it — MCDI's
 * `InboundWebhookRow` (inbound-webhooks.repository.ts, `PUBLIC_COLUMNS`).
 * The signing secret is never part of it.
 */
export interface InboundWebhook {
  id: string;
  projectId: string;
  name: string;
  slug: string;
  schema: unknown;
  acceptedOrigins: string[];
  requireSignature: boolean;
  rejectUnknownFields: boolean;
  allowRoleInheritance: boolean;
  isActive: boolean;
  submissionCount: number;
  lastSubmissionAt: string | null;
  createdAt: string;
  updatedAt: string;
}

const INBOUND_WEBHOOK_FIELDS = [
  'id',
  'projectId',
  'name',
  'slug',
  'schema',
  'acceptedOrigins',
  'requireSignature',
  'rejectUnknownFields',
  'allowRoleInheritance',
  'isActive',
  'submissionCount',
  'lastSubmissionAt',
  'createdAt',
  'updatedAt',
] as const satisfies readonly (keyof InboundWebhook)[];

/** Keeps only the documented public fields, so nothing secret-like MCDI might add later is ever echoed. */
function toInboundWebhook(raw: unknown): InboundWebhook {
  const row = raw as Record<string, unknown> | null;
  if (typeof row?.id !== 'string' || typeof row.name !== 'string') {
    throw new CliError(
      'MCDI inbound webhook response has an unexpected shape',
      ExitCode.Unexpected,
    );
  }
  const picked: Record<string, unknown> = {};
  for (const field of INBOUND_WEBHOOK_FIELDS) picked[field] = row[field];
  return picked as unknown as InboundWebhook;
}

/**
 * Turns a NestJS error body into text: MCDI's `errors: [{path, code, message}]`
 * (schema rejections) one per line in the same `path  code  message` layout as
 * the local pre-check, otherwise the `message` string or list on one line.
 */
function describeError(body: unknown): string | undefined {
  const b = body as { message?: unknown; errors?: unknown } | null;
  if (Array.isArray(b?.errors) && b.errors.length > 0) {
    const lines = b.errors.map((e: { path?: unknown; code?: unknown; message?: unknown }) =>
      [e.path, e.code, e.message].filter((part) => typeof part === 'string' && part).join('  '),
    );
    return lines.map((line) => `\n  ${line}`).join('');
  }
  if (Array.isArray(b?.message)) return b.message.join('; ');
  if (typeof b?.message === 'string') return b.message;
  return undefined;
}

/**
 * An authenticated call to MCDI's admin API with a session token, mapping
 * failures onto the PRD §11 exit codes. `profileName` only feeds the re-login hint.
 */
async function adminRequest(
  baseUrl: string,
  token: string,
  profileName: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await request(baseUrl, path, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.ok) return res.status === 204 ? undefined : readJson(res, `${method} ${path}`);

  const detail = describeError(await res.json().catch(() => null));
  const suffix = detail ? `: ${detail}` : '';
  if (res.status === 401) {
    throw new CliError(
      `MCDI rejected the session (invalid or expired); run \`mcdi-cli login --profile ${profileName}\``,
      ExitCode.Auth,
    );
  }
  if (res.status === 403) {
    throw new CliError(
      'this Discord account is not a system admin on this MCDI instance',
      ExitCode.Auth,
    );
  }
  if (res.status === 404) throw new CliError(`not found${suffix}`, ExitCode.NotFound);
  if (res.status === 400 || res.status === 409 || res.status === 422) {
    const separator = detail?.startsWith('\n') ? '' : ': ';
    throw new CliError(
      `MCDI rejected the request (HTTP ${res.status}, source: mcdi)${detail ? `${separator}${detail}` : ''}`,
      ExitCode.Rejected,
    );
  }
  throw new CliError(
    `MCDI returned HTTP ${res.status} for ${method} ${path}${suffix}`,
    ExitCode.Unexpected,
  );
}

export interface Project {
  id: string;
  name: string;
}

function toProject(raw: unknown): Project {
  const r = raw as Partial<Record<keyof Project, unknown>> | null;
  if (typeof r?.id !== 'string' || typeof r.name !== 'string') {
    throw new CliError('MCDI project response has an unexpected shape', ExitCode.Unexpected);
  }
  return { id: r.id, name: r.name };
}

/** GET /admin/projects → active projects this admin can create webhooks on. */
export async function listProjects(session: Session): Promise<Project[]> {
  const body = await adminRequest(
    session.baseUrl,
    session.token,
    session.profileName,
    'GET',
    '/admin/projects',
  );
  if (!Array.isArray(body)) {
    throw new CliError('MCDI project list response is not an array', ExitCode.Unexpected);
  }
  return body.map(toProject);
}

/** GET /admin/inbound-webhooks[?projectId=] → webhooks, newest first. */
export async function listInboundWebhooks(
  session: Session,
  projectId?: string,
): Promise<InboundWebhook[]> {
  const query = projectId ? `?${new URLSearchParams({ projectId })}` : '';
  const body = await adminRequest(
    session.baseUrl,
    session.token,
    session.profileName,
    'GET',
    `/admin/inbound-webhooks${query}`,
  );
  if (!Array.isArray(body)) {
    throw new CliError('MCDI inbound webhook list response is not an array', ExitCode.Unexpected);
  }
  return body.map(toInboundWebhook);
}

const webhookPath = (id: string) => `/admin/inbound-webhooks/${encodeURIComponent(id)}`;

/** GET /admin/inbound-webhooks/:id → the webhook (404 → exit 4). */
export async function getInboundWebhook(session: Session, id: string): Promise<InboundWebhook> {
  return toInboundWebhook(
    await adminRequest(session.baseUrl, session.token, session.profileName, 'GET', webhookPath(id)),
  );
}

/** The `UpdateInboundWebhookDto` fields mcdi-cli sends; only the ones being changed are included. */
export interface InboundWebhookPatch {
  name?: string;
  schema?: Record<string, unknown>;
  isActive?: boolean;
}

/** PATCH /admin/inbound-webhooks/:id → the updated webhook (400 → exit 2, 404 → exit 4). */
export async function updateInboundWebhook(
  session: Session,
  id: string,
  patch: InboundWebhookPatch,
): Promise<InboundWebhook> {
  return toInboundWebhook(
    await adminRequest(
      session.baseUrl,
      session.token,
      session.profileName,
      'PATCH',
      webhookPath(id),
      patch,
    ),
  );
}

/** PUT /admin/inbound-webhooks/:id/roles → the stored replacement set (400 → exit 2, 404 → exit 4). */
export async function setInboundWebhookRoles(
  session: Session,
  id: string,
  roleIds: string[],
): Promise<string[]> {
  const body = (await adminRequest(
    session.baseUrl,
    session.token,
    session.profileName,
    'PUT',
    `${webhookPath(id)}/roles`,
    {
      roleIds,
    },
  )) as { roleIds?: unknown } | null;
  if (!Array.isArray(body?.roleIds) || !body.roleIds.every((r) => typeof r === 'string')) {
    throw new CliError('MCDI roles response has an unexpected shape', ExitCode.Unexpected);
  }
  return body.roleIds;
}

/** The `CreateInboundWebhookDto` fields mcdi-cli sends. */
export interface CreateInboundWebhookBody {
  projectId: string;
  name: string;
  slug: string;
  schema: Record<string, unknown>;
  allowedRoleIds: string[];
  acceptedOrigins?: string[];
}

/** MCDI's `CreateInboundWebhookResult`; `signingSecret` is returned this once and never again. */
export interface CreatedInboundWebhook {
  webhook: InboundWebhook;
  signingSecret: string;
  allowedRoleIds: string[];
  submitUrl: string;
  docsUrl: string;
}

/** POST /admin/inbound-webhooks → the new webhook and its signing secret (400/409 → exit 2). */
export async function createInboundWebhook(
  session: Session,
  body: CreateInboundWebhookBody,
): Promise<CreatedInboundWebhook> {
  const res = (await adminRequest(
    session.baseUrl,
    session.token,
    session.profileName,
    'POST',
    '/admin/inbound-webhooks',
    body,
  )) as Partial<Record<keyof CreatedInboundWebhook, unknown>> | null;
  if (
    typeof res?.signingSecret !== 'string' ||
    typeof res.submitUrl !== 'string' ||
    typeof res.docsUrl !== 'string' ||
    !Array.isArray(res.allowedRoleIds)
  ) {
    throw new CliError('MCDI create response has an unexpected shape', ExitCode.Unexpected);
  }
  return {
    webhook: toInboundWebhook(res.webhook),
    signingSecret: res.signingSecret,
    allowedRoleIds: res.allowedRoleIds as string[],
    submitUrl: res.submitUrl,
    docsUrl: res.docsUrl,
  };
}

/** DELETE /admin/inbound-webhooks/:id → 204; MCDI also deletes every submission (404 → exit 4). */
export async function deleteInboundWebhook(session: Session, id: string): Promise<void> {
  await adminRequest(
    session.baseUrl,
    session.token,
    session.profileName,
    'DELETE',
    webhookPath(id),
  );
}

/** Validates MCDI's rotate-secret response shape; factored out so it's testable without a network call. */
export function parseRotatedSecret(body: unknown): string {
  const b = body as { signingSecret?: unknown } | null;
  if (typeof b?.signingSecret !== 'string') {
    throw new CliError('MCDI rotate-secret response has an unexpected shape', ExitCode.Unexpected);
  }
  return b.signingSecret;
}

/**
 * POST /admin/inbound-webhooks/:id/rotate-secret → the new signing secret.
 * MCDI returns it exactly once and never re-issues it; the old secret stops
 * verifying immediately (404 → exit 4).
 */
export async function rotateInboundWebhookSecret(session: Session, id: string): Promise<string> {
  return parseRotatedSecret(
    await adminRequest(
      session.baseUrl,
      session.token,
      session.profileName,
      'POST',
      `${webhookPath(id)}/rotate-secret`,
    ),
  );
}
