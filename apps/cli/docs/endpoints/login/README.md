# Login — MCDI endpoints

`mcdi-cli login` / `logout` / `whoami` are backed by MCDI's **system admin**
Discord OAuth flow — not the project-SSO flow documented in MCDI's
`docs/auth-integration.md` (that one is for third-party platforms embedding
MCDI as an identity provider; its API-key based token exchange doesn't fit a
developer's personal CLI). The admin flow is a separate controller in
`apps/api/src/modules/auth/auth.controller.ts` on the MCDI repo.

All routes below are relative to the MCDI API base URL (e.g.
`https://mcdi.microclub-usthb.org/api`).

## `GET /auth/admin/discord` — start login

Source: `AuthController.adminDiscordLogin` → `AdminAuthService.buildAdminDiscordLoginUrl`.

Generates a one-time `state` token (stored server-side, 10-minute expiry) and
returns the Discord authorization URL to send the admin to.

- No auth required to call this endpoint.
- Response shape depends on the `Accept` header:
  - `Accept: text/html` → **302 redirect** straight to Discord.
  - anything else (e.g. `Accept: application/json`) → **200** with
    `{ "url": "https://discord.com/api/oauth2/authorize?..." }`.

mcdi-cli should call it with a JSON `Accept` header and open the returned
`url` in the system browser itself — that's what makes `mcdi-cli login` "open
in the browser" from a CLI process rather than relying on a redirect, which
doesn't make sense outside an actual browser tab.

```
GET /api/auth/admin/discord
Accept: application/json

200 OK
{ "url": "https://discord.com/api/oauth2/authorize?client_id=...&redirect_uri=...&state=..." }
```

## `GET /auth/admin/discord/callback` — Discord lands here

Source: `AuthController.adminDiscordCallback` → `AdminAuthService.handleAdminDiscordCallback`.

Discord redirects the browser here with `?code=&state=` after consent. MCDI:

1. Validates and consumes the `state` token.
2. Exchanges the Discord `code` for a Discord access token, using the
   **server-configured** `discord.adminRedirectUri` (Discord only accepts a
   registered redirect URI, so this endpoint stays the landing point).
3. Resolves the Discord profile, verifies guild membership and that the
   member holds one of the configured admin role IDs; rejects with `403` if
   not.
4. Issues a 24-hour session token.
5. Sets it as the `admin_session` httpOnly cookie.
6. **302 redirects the browser to the configured admin frontend URL** —
   there is no way for the caller to redirect this to an arbitrary
   `redirect_uri` (e.g. a CLI's loopback listener), and the token is never
   put in the redirect URL — only in the cookie.

This endpoint is not directly callable by mcdi-cli; it only matters because
it's where the browser ends up after the admin approves on Discord. For a
web login it hands the session to the admin **web** frontend; for a CLI
login see [CLI login](#cli-login-loopback-redirect--pkce) below.

## `GET /auth/admin/me` — whoami / session introspection

Source: `AuthController.adminMe` → `AdminAuthService.getMe`. Guarded by
`SystemAdminGuard`.

This is the endpoint `mcdi-cli whoami` needs — it already exists (the PRD's
§13 "D3" gap is resolved on the current API).

- Auth: `Authorization: Bearer <session-token>` **or** the `admin_session`
  cookie — same mechanism, either works.
- `401` if the token/cookie is missing, invalid, or expired.
- `403` if the session is valid but the member no longer holds an admin role.

```
GET /api/auth/admin/me
Authorization: Bearer <session-token>

200 OK
{
  "id": "...",
  "username": "...",
  "globalName": "...",
  "displayName": "...",
  "preferredName": "...",
  "avatar": "...",
  "email": "...",
  "isSystemAdmin": true,
  "sessionExpiresAt": "2026-10-09T12:00:00.000Z"
}
```

## `POST /auth/admin/logout` — logout

Source: `AuthController.adminLogout`. Guarded by `SystemAdminGuard`.

Invalidates the current admin session server-side and clears the
`admin_session` cookie (irrelevant for a CLI caller, which holds the token
itself, not a cookie jar).

```
POST /api/auth/admin/logout
Authorization: Bearer <session-token>

200 OK
{ "success": true }
```

`mcdi-cli logout` should call this, then drop the stored session from the
local profile regardless of the response (a session that's already expired
server-side should still be clearable locally).

## No refresh endpoint for this flow

Unlike the project-SSO flow (`POST /auth/token/refresh`), the admin session
has no refresh endpoint — it's a flat 24-hour token. On `401`, mcdi-cli should
not attempt a silent refresh for the admin session (contrary to PRD §5.3,
which assumed refresh semantics shared with the SSO flow); it should tell
the developer to run `mcdi-cli login --profile <name>` again.

## CLI login: loopback redirect + PKCE

Status: implemented in MCDI PR
[#191](https://github.com/MicroClub-USTHB/MCDI/pull/191) (mcdi-cli issue #2),
**not deployed yet**. Until it is, the real MCDI ignores the extra query
parameters below, sends the browser to the admin panel, and answers
`POST /auth/admin/token` with `404`, so `mcdi-cli login` times out with a hint
pointing at issue #2. The web panel flow above is unchanged either way.

This is the standard native-app OAuth pattern (RFC 8252 loopback redirect,
RFC 7636 PKCE):

1. mcdi-cli starts a listener on `http://127.0.0.1:<port>/callback`, creates a
   random PKCE `code_verifier`, and calls:

   ```
   GET /api/auth/admin/discord?redirect_uri=http%3A%2F%2F127.0.0.1%3A<port>%2Fcallback
       &code_challenge=<BASE64URL(SHA256(code_verifier))>&code_challenge_method=S256
   Accept: application/json

   200 OK
   { "url": "https://discord.com/api/oauth2/authorize?...&state=..." }
   ```

   `redirect_uri` must be an `http` loopback URL with an explicit port
   (`127.0.0.1`, `localhost` or `[::1]`); PKCE `S256` is required with it.
   Anything else is `400`.
2. The admin approves on Discord. MCDI's callback runs the same guild and
   admin-role checks as the web login, then redirects the browser to the
   loopback URL:
   - success: `?code=<one-time code>&state=<state>` (the code expires after
     MCDI's `callbackCodeTtlSec`, 120 s by default, and works once);
   - refusal: `?error=<message>&state=<state>`, e.g. `Only members with a
     configured admin role can access the admin panel`.
3. mcdi-cli checks `state`, then exchanges the code:

   ```
   POST /api/auth/admin/token
   Content-Type: application/json
   { "code": "<one-time code>", "codeVerifier": "<code_verifier>" }

   200 OK
   { "token": "<admin session token>", "expiresAt": "2026-10-08T12:00:00.000Z" }
   ```

   Unknown, used or expired codes and wrong verifiers all get the same `401`.
   The session is a normal 24-hour admin session (Bearer), so `/auth/admin/me`
   and `/auth/admin/logout` work with it as above.

In mcdi-cli, `readCallback()` in `src/login-flow.ts` reads step 2,
`src/pkce.ts` creates the verifier/challenge, and `exchangeAdminLoginCode()`
in `src/mcdi.ts` does step 3.

## Gaps for mcdi-cli

1. **Deployment only.** The CLI login above needs MCDI PR
   [#191](https://github.com/MicroClub-USTHB/MCDI/pull/191) merged and
   deployed; mcdi-cli already implements its side. Until then a real
   `mcdi-cli login` can't complete.
