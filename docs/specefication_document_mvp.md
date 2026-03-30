# MCDI - Current Release Requirements

## MicroClub Discord Interface

> This document reflects the requirements implemented in the current backend release.
> For next-phase roadmap and architecture direction, see `specefication_document_last_version.md`.
> For schema details, see `database_architecture_mvp.md`.

---

## 1. Project Overview

### What is MCDI?

MCDI is the centralized backend service that connects MicroClub applications to Discord for authentication, membership checks, permission resolution, and multi-server administration.

### Current Release Goal

The current release focuses on:

- one reusable Discord login flow for MicroClub projects
- central member and role synchronization
- project-scoped access control per server
- admin tooling for projects, servers, sync, and cross-server visibility

### Primary Users

- **Club Members**: sign in to MicroClub apps with Discord
- **Project Developers**: integrate their apps through MCDI APIs
- **System Admins**: manage projects, servers, permissions, and sync operations

---

## 2. Requirement Status Summary

| ID | Requirement | Status | Notes |
| --- | --- | --- | --- |
| F1 | Discord OAuth Login | Implemented | Browser redirect flow with validated project, redirect URI, and server access |
| F2 | API Key Authentication for Projects | Implemented | `X-API-Key` auth with hash-only secret storage |
| F4 | Member Data Access | Implemented | Single-member lookup, paginated search, effective permission listing |
| F5 | Member Synchronization Using Discord.js | Implemented | Startup sync, manual sync queue, and real-time member updates |
| F6 | Role-Based Permissions | Implemented | Permission resolution based on synchronized Discord roles |
| F7 | Server-Side Permission Checking API | Implemented | Single and batch checks plus resolved permission listing |
| F8 | Server Registration And Configuration | Implemented | Register, list, update, enable, disable, and delete servers |
| F9 | Multi-Server Member View | Implemented | Admin cross-server member view and export |
| F10 | Server-Scoped Permissions | Implemented | Project access, scopes, and permission checks are server-aware |
| F11 | Server Synchronization | Implemented | Queue-based full syncs and gateway-driven incremental updates |
| F12 | Server Access Control For Projects | Implemented | Per-project/per-server mappings with operations, scopes, and audit logs |
| F13 | Server Statistics And Dashboard | Partial | Sync status, logs, and exports exist; full analytics dashboard is not yet implemented |

---

## 3. Detailed Current Requirements

### Feature Category: Authentication And Access Control

#### F1. Discord OAuth Login

**What**: Members can log in to a MicroClub application through Discord using MCDI as the central identity service.

**Implemented Capabilities**:

- Project initiates login with `client_id`, `redirect_uri`, `server_id`, and `state`
- MCDI validates the project and the exact redirect URI
- MCDI confirms the project has access to the requested server
- User is redirected to Discord OAuth
- After callback, MCDI verifies guild membership and project access rules
- MCDI returns a one-time callback code to the project for backend exchange

**Acceptance Notes**:

- Invalid projects fail before redirect
- Unapproved redirect URIs are rejected
- Unauthorized server access returns a safe error
- Callback codes are short-lived and one-time use

---

#### F2. API Key Authentication For Projects

**What**: Every project receives an API key and uses it for backend-to-backend requests.

**Implemented Capabilities**:

- API keys use a `prefix.secret` format
- Only the secret hash is stored in the database
- API keys can be regenerated
- API keys can be revoked or restored by admins
- API key lookups are cached in Redis for fast repeated access

**Acceptance Notes**:

- Full API keys are returned once at creation or regeneration time
- Revoked keys stop authorizing project requests
- API keys are scoped to the owning project

---

#### Additional Implemented Auth Capability: Admin Discord Login

This was not called out explicitly in the original MVP document, but it is part of the current implementation.

**Implemented Capabilities**:

- Admin login is handled through Discord OAuth
- MCDI verifies that the user belongs to the configured main guild
- MCDI verifies the user holds the `Executive` role
- A bearer session token and `admin_session` cookie are issued after successful login

---

### Feature Category: Member Management

#### F4. Member Data Access

**What**: Projects can retrieve member information for a specific managed Discord server.

**Implemented Capabilities**:

- Fetch a single member by Discord ID in a server
- Search members by username, global name, or display name
- Filter by role, active status, and club-member status
- Paginate large member lists
- Retrieve the resolved permission set of a specific member in a server

**Acceptance Notes**:

- All member reads are scoped to project/server access
- Missing scope or missing access returns `403`
- Input is validated through DTOs and rejected if malformed

---

#### F5. Member Synchronization Using Discord.js

**What**: MCDI keeps member data aligned with Discord.

**Implemented Capabilities**:

- Startup sync across active servers
- Manual queued full syncs through admin APIs
- Real-time updates for member join, leave, profile changes, and role changes
- Inactive membership marking for members missing from a fresh sync
- Sync logs and granular change records

**Acceptance Notes**:

- Sync runs independently per server
- Member and permission caches are invalidated after relevant changes
- Failures are recorded in sync logs instead of silently discarded

---

### Feature Category: Permissions And Roles

#### F6. Role-Based Permissions

**What**: MCDI resolves permissions from synchronized Discord roles.

**Implemented Capabilities**:

- Permission lookup from stored role-permission mappings
- Role synchronization from Discord bitfields
- Support for inheritance rules that extend permissions from a source role
- Per-server permission resolution

**Acceptance Notes**:

- Permission results are cached in memory for short periods
- Cache invalidates on sync or role membership changes

---

#### F7. Permission Checking API

**What**: Projects can ask whether a member has one or more permissions in a server.

**Implemented Capabilities**:

- Check one permission
- Check many permissions with `ALL`
- Check many permissions with `ANY`
- Fetch the full resolved permission set for a member
- Restrict permission checks to projects with the correct scope

**Acceptance Notes**:

- Permission checks are project-scoped and server-scoped
- Disabled servers are blocked globally before these checks run

---

### Feature Category: Server Management

#### F8. Server Registration And Configuration

**What**: Admins can register and manage Discord servers under MCDI.

**Implemented Capabilities**:

- Register a server by guild ID
- List servers with filters
- Update server settings and metadata
- Mark one server as the main server
- Enable or disable a server
- Delete a server and its associated data

**Acceptance Notes**:

- Disabled servers are excluded from project-facing reads
- Server registration can also happen automatically when the bot joins a guild

---

#### F9. Multi-Server Member View

**What**: Admins can inspect member participation across all managed servers.

**Implemented Capabilities**:

- View all servers a member belongs to
- View roles per server
- Paginate a cross-server member list
- Export cross-server member data as CSV or JSON

**Acceptance Notes**:

- Cross-server views are admin-only
- Export supports reporting and operational review

---

#### F10. Server-Scoped Permissions

**What**: MCDI applies access control in the context of a specific Discord server.

**Implemented Capabilities**:

- Project access is defined per project/server pair
- Scopes are stored per project/server mapping
- Operations are stored per project/server mapping
- Permission resolution runs inside a server context
- Inheritance rules can target all servers or selected servers

**Acceptance Notes**:

- A project can be authorized for one server and denied for another
- The same member can resolve to different permissions across servers

---

#### F11. Server Synchronization

**What**: MCDI keeps managed servers synchronized with Discord.

**Implemented Capabilities**:

- Queued full syncs with heartbeat tracking
- Startup sync scheduling for active servers
- Real-time listeners for guild, role, member, and user events
- Sync status endpoints
- Sync log endpoints
- Per-change detail tracking

**Acceptance Notes**:

- Sync conflict prevention avoids duplicate active syncs on the same server
- Queue draining continues automatically after startup

---

#### F12. Server Access Control For Projects

**What**: Admins define which projects may access which servers and what they may do there.

**Implemented Capabilities**:

- Grant access to a project for a server
- Update operations and scopes on an existing mapping
- Revoke access
- List servers by project
- List projects by server
- View the full access matrix
- View audit history for access changes

**Acceptance Notes**:

- Access changes invalidate related caches
- Audit entries record `GRANT`, `UPDATE`, and `REVOKE`

---

#### F13. Server Statistics And Dashboard

**What**: Admins need visibility into server health and usage.

**Current Status**: Partial

**Implemented Today**:

- Latest sync status per server
- Sync status across all active servers
- Sync log history
- Sync change details
- Cross-server member export

**Still Missing For Full Completion**:

- aggregate server statistics endpoints
- member growth charts
- role distribution summaries
- a dedicated admin dashboard UI

---

## 4. Additional Implemented Requirements Since The Original MVP Draft

The codebase now includes several capabilities that were not clearly represented in the original MVP document:

- admin Discord OAuth with Executive-role enforcement
- redirect URI allowlisting per project
- per-project server scopes (`read_members`, `check_permissions`)
- project-server access audit history
- sync queue heartbeat and lease behavior
- granular sync change records
- Swagger/OpenAPI documentation generated from controllers and DTOs

---

## 5. Explicitly Out Of Scope For The Current Release

These features are not yet implemented in the current backend and should not be treated as shipped requirements:

- project-facing Discord message sending APIs
- webhook creation and execution APIs
- channel listing and history APIs
- project usage analytics dashboard
- refresh-token-based member session renewal
- SDK packages for external frameworks

