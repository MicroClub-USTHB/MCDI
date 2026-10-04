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
   **server-configured** `discord.adminRedirectUri` (not a caller-supplied
   `redirect_uri` — see [Gaps](#gaps-for-mcdi-cli) below).
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
it's where the browser ends up after the admin approves on Discord, and
today it hands the resulting session to the admin **web** frontend, not back
to mcdi-cli. See [Gaps](#gaps-for-mcdi-cli).

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

## Gaps for mcdi-cli

These block building `login`/`logout`/`whoami` exactly as scoped in the PRD
(§13) and are the subject of the tracking issues in this repo:

1. **No caller-supplied redirect target.** `admin/discord/callback` always
   redirects to the configured admin frontend URL and only ever hands the
   session to a cookie. A CLI with a local loopback listener
   (`http://127.0.0.1:<port>/callback`) has no way to receive the resulting
   token — it needs the callback to redirect to *its* URL with the token (or
   a short-lived code to exchange), gated to a safe allowlist (loopback
   addresses only), not an open redirect.
2. **Discord `redirect_uri` is also fixed server-side**
   (`discord.adminRedirectUri`), independent of (1) — Discord itself will
   only accept a registered redirect URI, so the admin app's own
   `/auth/admin/discord/callback` has to stay the landing point; the gap is
   specifically MCDI relaying the result onward to mcdi-cli's loopback
   listener afterward, not Discord's redirect.
3. Once (1)/(2) are resolved, confirm the state param or an equivalent is
   enough for mcdi-cli to correlate its local pending login with the
   eventual callback (CSRF/replay protection for a non-browser caller).
