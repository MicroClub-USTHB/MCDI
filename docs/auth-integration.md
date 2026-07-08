# MCDI Auth Integration Guide

This is the integrator-facing reference for platforms that want to use MCDI as their identity provider. There are **two ways** to start a login. They share the same callback, the same token exchange, and the same session API — the only thing that differs is the entry point.

> **TL;DR**
> - **Default login button → `GET /api/auth/sso/authorize`** (SSO-aware; returning users skip Discord)
> - **Step-up / "force re-auth" → `GET /api/auth/authorize`** (always shows Discord)
> - Everything after the callback is identical between the two.

---

## Which entry point to use?

| If you want… | Use | Why |
|---|---|---|
| The standard "Login with MicroClub" button | `GET /api/auth/sso/authorize` | First login goes through Discord; later logins on **any** MCDI project skip it. |
| To force the user to re-prove their Discord identity (admin action, payment change, role-sensitive operation) | `GET /api/auth/authorize` | Always bounces through the Discord consent screen even if a global SSO cookie is present. |
| To stay compatible with an existing integration | `GET /api/auth/authorize` | Pre-SSO behavior, unchanged. No migration required. |

Both entry points feed the **same callback** (`GET /api/auth/discord/callback`), produce the **same `?code=&state=`** redirect to your `redirect_uri`, and the **same project session** when you exchange the code. Your backend doesn't care which one was used.

---

## Flow A — SSO-aware login (recommended for new integrations)

```
┌──────────┐          ┌──────┐         ┌─────────┐         ┌──────────┐
│ Browser  │          │ MCDI │         │ Discord │         │ Platform │
└────┬─────┘          └──┬───┘         └────┬────┘         └────┬─────┘
     │  Click "Login"    │                  │                   │
     │ ──────────────────┼──────────────────┼──────────────────►│
     │                   │                  │                   │
     │   302 to /api/auth/sso/authorize?... │                   │
     │◄──────────────────┼──────────────────┼───────────────────│
     │                   │                  │                   │
     │  GET /sso/authorize (carries mcdi_sso cookie if any)     │
     │ ─────────────────►│                  │                   │
     │                   │ ──── cookie valid? ─── YES ────────► │
     │                   │                  │                   │
     │       (no Discord bounce — straight to your callback)    │
     │◄──────────────────│                  │                   │
     │   ?code=&state=   │                  │                   │
     │                   │                  │                   │
     │  ─── cookie absent / expired ── fall through ────────────│
     │                   │ ───────────────► │                   │
     │                   │   Discord OAuth  │                   │
     │                   │◄─────────────────│                   │
     │                   │ set mcdi_sso cookie                  │
     │◄──────────────────│                  │                   │
     │   ?code=&state= (to platform redirect_uri)               │
     │                   │                  │                   │
     │  POST your /auth/callback { code }   │                   │
     │ ────────────────────────────────────────────────────────►│
     │                   │   POST /api/auth/token (X-API-Key)   │
     │                   │◄─────────────────────────────────────│
     │                   │  { token, refreshToken, member,…}    │
     │                   │ ────────────────────────────────────►│
```

**Frontend (the login button):**

```ts
const params = new URLSearchParams({
  client_id: PROJECT_ID,
  redirect_uri: 'https://platform-a.example.com/auth/callback',
  server_id: '900000000000000001',
  state: crypto.randomUUID(), // CSRF — store and verify on callback
});
window.location.href = `https://mcdi.example.com/api/auth/sso/authorize?${params}`;
```

**Result:**
- **First-ever login:** bounces through Discord, sets `mcdi_sso` httpOnly cookie, redirects to your `redirect_uri` with `?code=&state=`.
- **Subsequent logins from the same browser, on any project:** no Discord screen — instant redirect with a fresh `?code=&state=`.

---

## Flow B — Legacy / force-re-auth login

```
┌──────────┐                ┌──────┐         ┌─────────┐
│ Browser  │                │ MCDI │         │ Discord │
└────┬─────┘                └──┬───┘         └────┬────┘
     │  GET /api/auth/authorize │                  │
     │ ────────────────────────►│                  │
     │                          │  ALWAYS bounces  │
     │                          │ ───────────────► │
     │                          │  Discord OAuth   │
     │                          │◄─────────────────│
     │  ?code=&state=           │                  │
     │◄─────────────────────────│                  │
```

**Frontend:**

```ts
window.location.href = `https://mcdi.example.com/api/auth/authorize?${params}`;
// Same params as Flow A.
```

**Use this when:**
- The action being protected requires fresh proof of identity (admin operations, sensitive account changes).
- You're integrating a platform that pre-dates SSO and you don't want to change behavior.

The Discord callback still mints an `mcdi_sso` cookie after a successful login, so a user who entered via `/authorize` will still benefit from SSO on their **next** login if it uses `/sso/authorize`. Going through `/authorize` doesn't disable SSO — it just refuses to consume an existing cookie.

---

## After the callback — identical for both flows

The rest of the integration is the same regardless of entry point.

### 1. Exchange the code (backend only — uses `X-API-Key`)

```ts
const res = await fetch('https://mcdi.example.com/api/auth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.MCDI_API_KEY, // never expose to the browser
  },
  body: JSON.stringify({
    clientId: PROJECT_ID,
    code,                                  // from ?code= in the redirect
    redirectUri: 'https://platform-a.example.com/auth/callback',
  }),
});
const { token, refreshToken, expiresAt, member, roles } = await res.json();
```

### 2. Validate a session on each protected request

```ts
await fetch('https://mcdi.example.com/api/auth/validate', {
  method: 'POST',
  headers: { 'X-API-Key': MCDI_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
// 200 → { member, roles } (roles fetched live, always current)
// 401 → token revoked or expired
```

### 3. Refresh before expiry

```ts
await fetch('https://mcdi.example.com/api/auth/token/refresh', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`, // still-valid access token
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ refreshToken }),
});
// → { accessToken, refreshToken, expiresAt }   old pair is dead immediately
```

### 4. Logout

```ts
// Project-scoped logout (kills only this platform's session)
await fetch('https://mcdi.example.com/api/auth/logout', {
  method: 'POST',
  headers: { 'X-API-Key': MCDI_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token }),
});
```

---

## SSO-only browser endpoints

These have no legacy equivalent — they only exist for SSO-aware UX. All four read the `mcdi_sso` cookie directly; you don't pass the session token or API key.

| Endpoint | Purpose |
|---|---|
| `GET /api/auth/sso/session` | "Am I logged in?" — returns the member if the cookie is valid, `401 { authenticated: false }` otherwise. Useful for a shared header that says "Hi, Alice". |
| `GET /api/auth/sso/sessions` | Lists every project session under the current SSO cookie (project name + when it was created + expiry). Powers a "Signed in to: MCDI Admin, Forum, Wiki" UI. |
| `POST /api/auth/sso/logout` | "Log me out everywhere." Destroys the SSO row and **every** project session for the member in one transaction, then clears the cookie. |

These are called directly from the browser with `credentials: 'include'`.

---

## Endpoint cheat-sheet

| Endpoint | Auth | Used by | Flow |
|---|---|---|---|
| `GET  /api/auth/sso/authorize` | `mcdi_sso` cookie (optional) | browser | SSO-aware login (skip Discord if cookie valid) |
| `GET  /api/auth/authorize`     | none                         | browser | Legacy / force re-auth (always Discord) |
| `GET  /api/auth/discord/callback` | —                         | Discord | Internal — both flows land here |
| `POST /api/auth/token`         | `X-API-Key`                  | platform backend | Exchange one-time code for session |
| `POST /api/auth/token/refresh` | session Bearer               | platform backend | Rotate access + refresh tokens |
| `POST /api/auth/validate`      | `X-API-Key`                  | platform backend | Verify token, get live roles |
| `POST /api/auth/logout`        | `X-API-Key`                  | platform backend | Kill one project session |
| `POST /api/auth/logout-all`    | `X-API-Key`                  | platform backend | Kill all of a member's sessions on this project |
| `GET  /api/auth/sso/session`   | `mcdi_sso` cookie            | browser | "Am I logged in?" |
| `GET  /api/auth/sso/sessions`  | `mcdi_sso` cookie            | browser | List all project sessions under this SSO |
| `POST /api/auth/sso/logout`    | `mcdi_sso` cookie            | browser | Log out from every project at once |

---

## Rules to keep in mind

- **`X-API-Key` is backend-only.** Anything that runs in the browser uses the session token (Bearer) or the SSO cookie.
- **`redirect_uri` must be whitelisted on your project.** MCDI refuses to redirect to anything else, even on errors.
- **`state` is your CSRF token.** Set it on the authorize call, verify it on the callback. MCDI passes it through unchanged.
- **Tokens are stored as SHA-256 hashes only.** A DB dump alone doesn't yield usable tokens.
- **Project sessions are isolated.** A token issued for Platform A is rejected by Platform B's `validate` call, even though they share the same SSO session.
- **Roles are fetched live on `validate`.** A revoked Discord role takes effect on the next validate call, not at session creation.

---

## Migrating an existing integration to SSO

You don't have to migrate. `GET /api/auth/authorize` is unchanged and will keep working indefinitely.

If you do want SSO:

1. Change the single URL on your login button from `/api/auth/authorize` to `/api/auth/sso/authorize`. No other backend changes are required — the callback, token exchange, validate, refresh, and logout calls are all identical.
2. Optionally, add a "Log out everywhere" button that calls `POST /api/auth/sso/logout`.
3. Optionally, add a "Signed in as Alice" header backed by `GET /api/auth/sso/session`.

That's the whole migration.
