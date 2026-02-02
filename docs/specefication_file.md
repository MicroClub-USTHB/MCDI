# MCDI - Feature Specification Document

## MicroClub Discord Interface

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

---

## **Version 2**

---

### Feature Category: Authentication & Access Control

#### F14. Session Management (Optional for now)

**What**: Keep users logged in across MicroClub apps without re-authenticating

**User Story**:

> As a club member, I want to stay logged in for a reasonable time, so I don't have to login repeatedly.

**Key Capabilities**:

- Access token valid for 24 hours
- Refresh token valid for 30 days
- Can logout from any app
- Logout from one app = logout everywhere (optional)

**Success Criteria**:

- Token automatically refreshes before expiry
- User stays logged in across browser sessions
- Logout works instantly

---

### Feature Category: Member Management

#### F15. Member Statistics

**What**: View aggregate statistics about club membership

**User Story**:

> As a club admin, I want to see member statistics, so I can understand club growth and composition.

**Key Capabilities**:

- Total member count
- Members by role (Executives, Leads, Sections, etc.)
- Members by department
- New members in last 30 days
- Active vs inactive members
- Member growth over time

**Success Criteria**:

- Statistics update daily
- Can export data as CSV
- Charts/graphs (nice to have)

---

### Feature Category: Permissions & Roles

#### F16. Role Management

**What**: Backend can view and manage role-permission mappings

**User Story**:

> I want to update what permissions each role has, so I can adjust access control as needed.

**Key Capabilities**:

- View all roles and their permissions
- Add permissions to a role
- Remove permissions from a role
- See role hierarchy
- Preview members affected by permission change

**Success Criteria**:

- Changes take effect immediately
- Cannot break executive role (always has all permissions)
- Audit log records all permission changes

---

### Feature Category: Discord Channel Operations

#### F17. Send Messages to Channels

**What**: Projects can send messages to Discord channels programmatically

**User Story**:

> As a project developer, I want to send announcements to a Discord channel, so users see important updates.

**Key Capabilities**:

- Send plain text messages
- Send rich formatted messages (embeds)
- Include images, links, buttons (Discord embeds)
- Mention users or roles (@everyone, @Lead, @username)
- Send to specific channels
- Send same message to multiple channels (bulk send)

**Success Criteria**:

- Message appears in Discord within 3 seconds
- Formatting displays correctly
- Rate limits prevent spam (max 5 messages/minute per project)
- Projects can only send to channels they have permission for

---

#### F18. Read Channel Information

**What**: Get information about Discord channels

**User Story**:

> As a project developer, I want to get a list of channels and their details, so users can choose where to post.

**Key Capabilities**:

- List all channels in the server
- Filter by channel type (text, voice, announcement)
- Filter by category
- Get channel name, topic, permissions
- Check if bot can access a channel

**Success Criteria**:

- Returns current channel list
- Includes channel metadata (topic, member count)
- Fast response (< 300ms)

---

#### F19. Channel Message History (Optional)

**What**: Retrieve recent messages from a channel

**User Story**:

> As a project developer, I want to fetch recent messages from a channel, so I can display them or analyze them.

**Key Capabilities**:

- Get last N messages from a channel
- Filter by date range
- Filter by author
- Paginate through history

**Success Criteria**:

- Can fetch up to 100 messages
- Respects Discord rate limits
- Only works for channels bot can access

---

### Feature Category: Webhook Management

#### F20. Create Webhooks

**What**: Projects can create Discord webhooks for channels

**User Story**:

> As a project developer, I want to create a webhook for a channel, so I can send messages without rate limit concerns.

**Key Capabilities**:

- Create webhook for any accessible channel
- Name the webhook
- Set webhook avatar
- Store webhook securely
- Maximum N webhooks per project (configurable)

**Success Criteria**:

- Webhook works immediately after creation
- Webhook URL is encrypted in storage
- Each project has separate webhooks

---

#### F21. Execute Webhooks

**What**: Send messages through existing webhooks

**User Story**:

> As a project developer, I want to send messages via webhook, so I can post frequently without hitting rate limits.

**Key Capabilities**:

- Send message through webhook
- Support embeds and formatting
- Track usage (how many times webhook used)
- Log all webhook executions

**Success Criteria**:

- Message sent via webhook in < 2 seconds
- Webhooks have higher rate limit than direct messages
- Failed executions retry automatically (3 attempts)

---

#### F22. Manage Webhooks

**What**: List, update, and delete webhooks

**User Story**:

> As a project developer, I want to manage my webhooks, so I can update or remove them when needed.

**Key Capabilities**:

- List all webhooks for my project
- Update webhook name or avatar
- Delete webhook when no longer needed
- See webhook usage statistics

**Success Criteria**:

- Can view all project webhooks
- Changes sync to Discord immediately
- Deleted webhooks stop working instantly

---

## **Version 3**

---

### Feature Category: Event System

#### F23. Event Subscriptions

**What**: Projects can subscribe to Discord events (e.g., member joined, role changed)

**User Story**:

> As a project developer, I want to be notified when certain Discord events happen, so my app can react in real-time.

**Key Capabilities**:

- Subscribe to specific event types
- Provide callback URL to receive events
- Filter events (e.g., only notify for specific roles)
- See event delivery history

**Success Criteria**:

- Events delivered within 10 seconds of occurring
- Failed deliveries are retried
- Can unsubscribe anytime

---

#### F24. Event Delivery

**What**: Reliably deliver events to subscribed projects

**User Story**:

> As a system, I want to ensure events reach projects even if their server is temporarily down.

**Key Capabilities**:

- Queue events for delivery
- Retry failed deliveries (with exponential backoff)
- Track delivery status (pending, delivered, failed)
- Alert admin if project webhook consistently fails

**Success Criteria**:

- Events delivered in order
- 99% delivery success rate
- Failed deliveries logged for debugging

---

### Feature Category: System Management

#### F25. Monitor System Usage

**What**: View how projects are using MCDI

**User Story**:

> As a club admin, I want to see system usage statistics, so I can identify issues or abuse.

**Key Capabilities**:

- Total API requests per project
- Messages sent per project
- Webhooks created per project
- Errors per project
- Most active projects
- Recent error logs
- System health (API up/down, Discord bot status)

**Success Criteria**:

- Statistics update in real-time or near real-time
- Can filter by date range
- Can export data for analysis

---

#### F26. Audit Logging

**What**: Track all important system actions

**User Story**:

> As a club admin, I want to see who did what and when, so I can troubleshoot issues and ensure security.

**Key Capabilities**:

- Log all admin actions (project created, API key revoked, etc.)
- Log all authentication events (login, logout, token refresh)
- Log all permission changes
- Log all message sends and webhook executions
- Search audit logs by date, user, action type
- Export audit logs

**Success Criteria**:

- All critical actions are logged
- Logs include: who, what, when, from where (IP)
- Logs retained for at least 90 days
- Fast search (< 1 second)

---

### Feature Category: Developer Tools

#### F27. API Documentation

**What**: Interactive API documentation for developers

**User Story**:

> As a project developer, I want to read API docs and try endpoints, so I can integrate quickly.

**Key Capabilities**:

- Complete API reference (all endpoints)
- Request/response examples
- Authentication examples
- Try endpoints directly from docs (Swagger UI)
- Code examples in multiple languages

**Success Criteria**:

- Every endpoint documented
- Examples are accurate and working
- Easy to navigate and search

---

#### F28. Integration Packages (Future)

**What**: Pre-built SDK packages for common frameworks

**User Story**:

> As a project developer, I want a ready-made package for Laravel, so I don't write integration code from scratch.

**Key Capabilities**:

- Laravel package with Auth provider
- Express.js middleware
- React hooks library
- Python SDK
- Easy installation (npm, composer, pip)

**Success Criteria**:

- Package installs in < 2 minutes
- Working example provided Authentication works out-of-the-box

---

## 3. System Architecture

### Overview

The MCDI system is designed as a modular, service-oriented architecture that handles all Discord integrations for MicroClub applications. The architecture separates concerns into distinct modules that interact through well-defined interfaces, ensuring scalability and maintainability.

![Discord OAuth Flow](https://i.postimg.cc/76q9wjwH/image.png)

### Core Components

#### 3.1 User Interaction Layer

- **Users**: Club members, system admins, project developers, and projects interact through:
  - Web applications (desktop)
  - Mobile applications
- **Authentication Flow**:
  1. User clicks "Login with Discord" on a MicroClub project
  2. Request forwarded to MCDI with project API key
  3. MCDI validates membership (checks main server or alternate server)
  4. Redirects to Discord OAuth2 for authorization
  5. Discord returns user's guilds and roles
  6. MCDI creates session and returns login result to project

#### 3.2 MCDI Service Modules

The core system consists of 9 specialized modules:

| **Module**                    | **Primary Responsibility**                                             | **Key Dependencies**         |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| **Authentication Module**     | Handles Discord OAuth2 flows, session management, and token validation | Discord OAuth2, Sessions DB  |
| **Members Module**            | Manages member data synchronization and access                         | Discord API, Members DB      |
| **Permission & Roles Module** | Manages role hierarchy and permission checks                           | Roles DB, Permissions DB     |
| **Server's Module**           | Manages Discord servers (registration, configuration, health)          | Servers DB, Discord API      |
| **Events Module**             | Handles real-time event subscriptions and delivery                     | Event Queue, Webhooks        |
| **DiscordOPS Module**         | Executes Discord operations (messages, channel management)             | Discord API, Webhooks        |
| **WebHooks Module**           | Manages webhook creation and execution                                 | Webhooks DB, Discord API     |
| **DevTools Module**           | Provides developer tools (API docs, SDKs, debugging)                   | External documentation tools |
| **System Module**             | Handles monitoring, logging, and system health                         | Monitoring tools, Audit logs |

#### 3.3 External Dependencies

- **Discord OAuth2**: Handles user authentication and authorization
- **Discord API**: Used for bot operations (member data, channel management, message sending)
- **MCDI Database**: Primary data store for all system data
- **Cached Data**: Redis-based cache for frequently accessed data (member profiles, permissions)

#### 3.4 Data Flow

1. **User Request**: Project sends authenticated request to MCDI
2. **Module Processing**:
   - Authentication module validates API key and session
   - Relevant module processes the request (e.g., Members Module for member data)
3. **External Interaction**:
   - Modules interact with Discord API as needed
   - Data written to MCDI Database or Cached Data
4. **Response**: Processed data returned to the project

#### 3.5 Key Architecture Decisions

- **Modular Design**: Each module has clear responsibilities with minimal coupling
- **Caching Strategy**: Frequently accessed data (member roles, permissions) cached for <100ms responses
- **Rate Limiting**: All Discord API calls respect Discord's rate limits with automatic retry logic- **Security**: All API keys and tokens encrypted at rest; sensitive operations require multi-factor auth for admins
- **Scalability**: Modules designed to handle 5+ concurrent Discord servers with 1000+ members each

#### 3.6 MVP Endpoints :

Authentication (F1, F2)
GET /auth/discord # Start OAuth
GET /auth/discord/callback # OAuth callback
GET /auth/me # Get current user
POST /auth/logout # Logout
No change needed - Schema supports this

Servers (F8, F11, F13)
GET /servers # List accessible servers
GET /servers/:id # Get server details
GET /servers/:id/stats # Get server statistics (F13)
GET /servers/:id/health # Bot status, sync time (F8)
POST /admin/servers # Register server
PATCH /admin/servers/:id # Update server (settings, type, is_active)
POST /admin/servers/:id/sync # Trigger sync (F11)
GET /admin/servers/:id/sync/logs # View sync logs (F11) - Uses server_sync_logs
Uses: servers, server_sync_logs

Members (F4, F5, F9)
GET /servers/:serverId/members # List server members (pagination)
GET /servers/:serverId/members/search # Search by name, filter by role
GET /servers/:serverId/members/:discordId # Get member with roles in that server
GET /members/:discordId # Get member cross-server view
GET /members/:discordId/servers # List all servers member is in + roles
GET /members/club # List members where is_club_member=true

Uses: members, server_members, server_member_roles, roles

Permissions (F6, F7, F10)
POST /servers/:serverId/permissions/check # Check single permission
POST /servers/:serverId/permissions/check-bulk # Check ALL/ANY of multiple permissions
GET /servers/:serverId/members/:discordId/permissions # Get ALL permissions for user (F7)
GET /servers/:serverId/roles # List roles with hierarchy_level
GET /servers/:serverId/permissions # List server + global permissions
Uses: roles, permissions, role_permissions, server_member_roles

Projects (F2, F12)
Important: Your schema has API key in projects table directly (no separate api_keys table):

GET /admin/projects # List projects
POST /admin/projects # Create project (generates first API key)
GET /admin/projects/:id # Get project details
PATCH /admin/projects/:id # Update project (name, is_active)
POST /admin/projects/:id/regenerate-key # Regenerate API key (F2: "Key can be regenerated")
GET /admin/projects/:id/servers # List project's server access (F12)
POST /admin/projects/:id/servers # Grant server access
DELETE /admin/projects/:id/servers/:serverId # Revoke server access (F12)
Uses: projects, project_servers

---

## 4. Database Design

### Overview

The MCDI database is optimized for the MVP features with a focus on member synchronization, permission management, and multi-server support. The design uses a relational model with normalized tables to ensure data integrity while supporting high-performance queries for member and permission data.

![Database Architecture](https://i.postimg.cc/QtPmLmNB/2026-02-02-21-47-49.png)

### Core Tables

#### 4.1 Servers Table (`servers`)

Manages all Discord servers (guilds) connected to MCDI.

- **Columns**:
  - `id` (UUID, PK)
  - `discord_guild_id` (VARCHAR, UK)
  - `name` (VARCHAR)
  - `type` (VARCHAR, DEFAULT 'competition')
  - `is_main` (BOOLEAN, DEFAULT false)
  - `is_active` (BOOLEAN, DEFAULT true)
  - `settings` (JSONB, DEFAULT {})
  - `synced_at` (TIMESTAMPTZ)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- **Relationships**:
  - Has many `server_members` (1:M)
  - Has many `server_sync_logs` (1:M)
  - Has many `roles` (1:M)
  - Has many `permissions` (1:M)

#### 4.2 Projects Table (`projects`)

Stores all MicroClub projects that integrate with MCDI.

- **Columns**:
  - `id` (UUID, PK)
  - `name` (VARCHAR)
  - `slug` (VARCHAR, UK)
  - `api_key_hash` (VARCHAR, UK)
  - `api_key_prefix` (VARCHAR)
  - `is_active` (BOOLEAN, DEFAULT true)
  - `api_key_created_at` (TIMESTAMPTZ, DEFAULT NOW())
  - `api_key_last_used_at` (TIMESTAMPTZ)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- **Relationships**:
  - Linked to many `project_servers` (1:M)

#### 4.3 Members Table (`members`)

Stores core member information synchronized from Discord.

- **Columns**:
  - `id` (UUID, PK)
  - `discord_id` (VARCHAR, UK)
  - `username` (VARCHAR)
  - `display_name` (VARCHAR)
  - `avatar_link` (VARCHAR)
  - `is_club_member` (BOOLEAN, DEFAULT false)
  - `global_name` (VARCHAR)
  - `last_seen_at` (TIMESTAMPTZ)
  - `synced_at` (TIMESTAMPTZ)
  - `created_at` (TIMESTAMPTZ, DEFAULT NOW())
- **Relationships**:
  - Joins many `server_members` (1:M)
  - Authenticates many `sessions` (1:M)

#### 4.4 Permissions Table (`permissions`)

Defines all permission keys used in the system.

- **Columns**:
  - `id` (UUID, PK)
  - `server_id` (UUID, FK, NULL=global)
  - `key` (VARCHAR)
  - `name` (VARCHAR)
- **Relationships**:
  - Assigned to many `role_permissions` (1:M)

#### 4.5 Roles Table (`roles`)

Stores Discord roles and their hierarchy.

- **Columns**:
  - `id` (UUID, PK)
  - `server_id` (UUID, FK)
  - `discord_role_id` (VARCHAR)
  - `name` (VARCHAR)
  - `hierarchy_level` (INTEGER, DEFAULT 0)
- **Relationships**:
  - Contains many `role_permissions` (1:M)
  - Grants many `server_member_roles` (1:M)

### Critical Relationships

#### 4.6 Multi-Server Member Management

- **`server_members`**: Tracks membership in specific servers
  - `server_id` (FK to `servers`)
  - `member_id` (FK to `members`)
  - `nickname` (VARCHAR)
  - `joined_at` (TIMESTAMPTZ)
  - `is_active` (BOOLEAN, DEFAULT true)
- **`server_member_roles`**: Assigns roles to members in specific servers
  - `server_member_id` (FK to `server_members`)
  - `role_id` (FK to `roles`)

#### 4.7 Permission Management

- **`role_permissions`**: Maps roles to permissions
  - `role_id` (FK to `roles`)
  - `permission_id` (FK to `permissions`)
- **`project_servers`**: Defines project access to servers
  - `project_id` (FK to `projects`)
  - `server_id` (FK to `servers`)
  - `operations` (JSONB, DEFAULT {'read': true})

#### 4.8 Synchronization & Sessions

- **`server_sync_logs`**: Tracks synchronization status
  - `server_id` (FK to `servers`)
  - `sync_type` (VARCHAR: 'full', 'incremental', 'manual')
  - `status` (VARCHAR: 'success', 'failed', 'in_progress')
  - `members_synced` (INTEGER, DEFAULT 0)
  - `roles_synced` (INTEGER, DEFAULT 0)
  - `started_at` (TIMESTAMPTZ)
  - `completed_at` (TIMESTAMPTZ)
- **`sessions`**: Manages user sessions
  - `member_id` (FK to `members`)
  - `access_token_hash` (VARCHAR)
  - `expires_at` (TIMESTAMPTZ)
  - `ip_address` (INET)
  - `user_agent` (VARCHAR)

### Key Design Principles

1. **Multi-Server Support**:
   - All member and role data is server-scoped (via `server_id` foreign keys)
   - Global permissions supported via `server_id = NULL` in permissions table

2. **Synchronization Tracking**:
   - `server_sync_logs` captures sync history for debugging and monitoring
   - `synced_at` timestamps in core tables enable real-time freshness checks

3. **Permission Inheritance**:
   - Hierarchical roles implemented via `hierarchy_level` in roles table
   - Role-permission mapping supports inheritance through role hierarchy

4. **Scalability Considerations**:
   - All critical tables include `created_at` and `synced_at` for time-based operations
   - JSONB fields used for flexible configuration (e.g., `settings`, `operations`)
   - UUID primary keys ensure distributed system compatibility

5. **Security Features**:
   - API keys stored as hash+prefix (never stored in plaintext)
   - Session tokens encrypted at rest with expiration tracking
   - All sensitive operations (e.g., role changes) logged in audit tables

This database design supports all MVP features while providing the foundation for Version 2 and 3 capabilities. The normalized structure ensures data integrity, while strategic denormalization (e.g., in `members` table) optimizes for read performance on critical paths.
