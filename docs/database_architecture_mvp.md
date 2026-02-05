# MCDI - Database Architecture (MVP)

> This document describes the MVP database design.
> For MVP features, see `specefication_document_mvp.md`.
> For later phases + System Architecture, see `specefication_document_last_version.md`.

---

## Database Design

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
