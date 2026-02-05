# MCDI - Feature Specification (Last Version)

## MicroClub Discord Interface

> This document covers post-MVP features (Version 2 + Version 3) and includes the System Architecture section.
> For MVP-only scope, see `specefication_document_mvp.md`.
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
