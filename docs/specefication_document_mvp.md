# MCDI - Feature Specification (MVP)

## MicroClub Discord Interface

> This document contains the MVP scope only.
> For later phases + System Architecture, see `specefication_document_last_version.md`.
> For database tables/relations, see `database_architecture_mvp.md`.

---

## 1. Project Overview

### What is MCDI?

MCDI is a centralized backend service that connects all MicroClub applications to Discord. Instead of each project implementing Discord integration separately, MCDI provides everything out-of-the-box through a simple API.

### The Goal

- Login once with Discord, access all MicroClub apps
- Centralized member and permission management
- Easy Discord operations (send messages, create webhooks, etc.)

### Target Users

- **Club Members**: Login to various club applications
- **Project Developers**: Integrate their apps with MCDI
- **Club Admins**: Manage projects and monitor the system

---

## MVP Version

## 2. Core Features

### Feature Category: Authentication & Access Control

#### F1. Discord OAuth Login

**What**: Members can login to any MicroClub project using their Discord account

**User Story**:

> As a club member, I want to login to a MicroClub app using my Discord account, so I don't need to create another username and password.

**Key Capabilities**:

- Click "Login with Discord" on any MicroClub app
- Redirected to Discord to authorize
- Automatically logged in after Discord approval
- Only works if member is in the Discord server
- Possibility to make Auth just for certain groups (Leads for example)

**Success Criteria**:

- Member can login in less than 10 seconds
- Works on web and mobile
- Fails gracefully if not a club member

---

#### F2. API Key Authentication for Projects

**What**: Each MicroClub project gets a unique API key to communicate with MCDI

**User Story**:

> As a project developer, I want a secure API key for my project, so I can make authenticated requests to MCDI.

**Key Capabilities**:

- Key can be regenerated
- Different projects have different permission levels

**Success Criteria**:

- API key works immediately after generation
- Revoked key stops working within 1 minute
- Keys are never exposed in logs or error messages

---

### Feature Category: Member Management

#### F4. Member Data Access

**What**: Projects can get information about club members

**User Story**:

> As a project developer, I want to fetch member information (name, avatar, roles), so I can display it in my app.

**Key Capabilities**:

- Get specific member by Discord ID
- Search members by name
- Filter members by role or department
- Get member's avatar, username, join date, roles and pretty much all infos.
- Paginated results for large lists

**Success Criteria**:

- Can fetch member info in < 200ms
- Search works with partial names
- Returns up-to-date information

---

#### F5. Member Synchronization Using Discord.js

**What**: Automatically keep member data updated from Discord server

**User Story**:

> As a system admin, I want member data to stay synchronized with Discord, so apps always show current information.

**Key Capabilities**:

- Import all members from Discord initially
- Detect when new members join
- Detect when members leave
- Detect when member roles change
- Detect when member profile updates (username, avatar)
- Manual trigger for full re-sync

**Success Criteria**:

- New members appear in database within 5 minutes
- Role changes reflected within 5 minutes
- Can handle 1000+ members without issues

---

### Feature Category: Permissions & Roles

#### F6. Role-Based Permissions

**What**: Control what members can do based on their Discord roles

**User Story**:

> As a project developer, I want to check if a member has permission to perform an action, so I can enforce access control.

**Key Capabilities**:

- Check if member has specific permission (e.g., "can_create_events")
- Hierarchical roles (Executive > Lead > Section > Department > Member)
- Higher roles inherit lower role permissions
- Custom permissions beyond Discord roles

**Success Criteria**:

- Permission check responds in < 100ms
- Permissions update when Discord roles change
- Easy to define new permissions

---

#### F7. Permission (ServerSide) Checking API

**What**: Simple API to verify if a user has specific permission

**User Story**:

> As a project developer, I want to ask "Does this user have permission X?", so I can allow or deny their action.

**Key Capabilities**:

- Check single permission: "Does user123 have 'events.create'?"
- Check multiple permissions: "Does user have ALL of [perm1, perm2]?"
- Check any permission: "Does user have ANY of [perm1, perm2]?"
- Get all permissions for a user
- Cache results for performance

**Success Criteria**:

- API responds with yes/no quickly
- Works for any permission string
- Results are accurate and up-to-date

---

### Feature Category: Server Management

#### F8. Server Registration & Configuration

**What**: System Admin can register and configure multiple Discord servers for MCDI to manage

**User Story**:

> As a System Admin, I want to add our club's Discord servers (main and competitions) to MCDI, so I can manage members across all our servers from one place.

**Key Capabilities**:

- Register a new Discord server by providing the bot invite or guild ID
- Mark one server as the "main" club server
- Categorize servers by type (main, competition, event, other)
- Enable/disable servers without deleting data
- Configure server-specific settings (sync frequency, default permissions)
- View server health status (bot connected, last sync time)

**Success Criteria**:

- Server appears in MCDI within 1 minute of bot joining
- Only one server can be marked as "main" at any time
- Disabling a server immediately blocks all API access to it
- Server settings can be updated without re-syncing

---

#### F9. Multi-Server Member View

**What**: View a member's presence and roles across all managed servers

**User Story**:

> As a System Admin member, I want to see which servers a person is in and what roles they have in each, so I can understand their involvement across all club activities.

**Key Capabilities**:

- View all servers a member belongs to
- See roles assigned in each server
- See join date for each server
- Identify if member is a "club member" (in main server) vs "participant" (only in event servers)
- Filter members by "club members only" or "all participants"
- Export cross-server member report

**Success Criteria**:

- Cross-server view loads in < 500ms
- Accurately reflects current server membership
- Clearly distinguishes club members from external participants

---

#### F10. Server-Scoped Permissions

**What**: Define and check permissions that apply within a specific server context

**User Story**:

> As a project developer, I want to check if a user has permission to perform an action in a specific server, so I can enforce server-appropriate access control.

**Key Capabilities**:

- Check permission for a user in a specific server
- Same user can have different permissions in different servers
- Global permissions (apply to all servers) vs server-specific permissions
- Permission inheritance: main server roles can optionally grant permissions in other servers
- Example: "Lead" in main server automatically gets "Organizer" permissions in competition servers

**Success Criteria**:

- Permission check specifies server context
- Same user correctly returns different permissions per server
- Global permissions work across all servers
- Inheritance rules are configurable

---

#### F11. Server Synchronization

**What**: Keep server data (members, roles, channels) synchronized with Discord

**User Story**:

> As a system admin, I want each server's data to stay synchronized with Discord, so apps always show accurate information for that server.

**Key Capabilities**:

- Full sync on bot startup for each server
- Real-time sync via Discord gateway events per server
- Manual trigger for full re-sync of a specific server
- View sync status and last sync time per server
- Sync logs showing what changed
- Handle bot being added/removed from servers

**Success Criteria**:

- Each server syncs independently
- New server members appear within 5 minutes
- Sync errors don't affect other servers
- Can sync 5+ servers without performance issues

---

#### F12. Server Access Control for Projects

**What**: Control which servers each project can access

**User Story**:

> As a System Admin, I want to grant specific projects access to specific servers, so the Events app only sees the main server while the Hackathon app can see both main and hackathon servers.

**Key Capabilities**:

- Grant a project access to one or more servers
- Specify allowed operations per server (read, send messages, manage webhooks)
- Revoke server access from a project
- View which projects have access to which servers
- Audit log of access grants/revocations

**Success Criteria**:

- Project can only access servers it's been granted
- API returns 403 for unauthorized server access
- Access changes take effect within 1 minute
- Easy to view project-server access matrix

---

#### F13. Server Statistics & Dashboard

**What**: View statistics and health for each managed server

**User Story**:

> As a System Admin, I want to see statistics for each server, so I can track participation and identify issues.

**Key Capabilities**:

- Member count per server
- Members by role breakdown per server
- New members in last 30 days per server
- Active vs inactive members
- Cross-server statistics (members in multiple servers)
- Server health (bot status, sync status, errors)

**Success Criteria**:

- Statistics update daily
- Can compare statistics across servers
- Health issues surfaced prominently
- Data exportable for reporting
