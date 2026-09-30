import type { PermissionPolicy, ServerType } from '@mcdi/contracts';

/**
 * Raw shape returned by `GET /api/servers`. This list response omits
 * `createdAt`/`updatedAt` (present on the single-resource `GET /api/servers/:id`)
 * and adds `lastSyncAt`/`botConnected` — the two endpoints return different
 * shapes, so this type isn't shared with the detail view once that's built.
 */
export interface ServerListItemDto {
  id: string;
  name: string;
  icon: string | null;
  type: ServerType;
  isMain: boolean;
  isActive: boolean;
  syncFrequencyHours: number;
  defaultPermissionPolicy: PermissionPolicy;
  disabledReason: string | null;
  syncedAt: string | null;
  lastSyncAt: string | null;
  botConnected: boolean;
}

export type { PermissionPolicy, ServerType };

/**
 * Raw shape returned by `POST /api/servers`, `PATCH /api/servers/:id/disable`,
 * and `PATCH /api/servers/:id/enable` — the bare `servers` table row, without
 * the list endpoint's `lastSyncAt`/`botConnected` join extras.
 */
export interface ServerDto {
  id: string;
  name: string;
  icon: string | null;
  type: ServerType;
  isMain: boolean;
  isActive: boolean;
  syncFrequencyHours: number;
  defaultPermissionPolicy: PermissionPolicy;
  disabledReason: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Body for `POST /api/servers` — the backend upserts by `guildId`. */
export interface CreateServerPayload {
  guildId: string;
  name?: string;
  icon?: string | null;
  type?: ServerType;
  isMain?: boolean;
  isActive?: boolean;
  syncFrequencyHours?: number;
  defaultPermissionPolicy?: PermissionPolicy;
  disabledReason?: string | null;
}

/** Body for `PATCH /api/servers/:id/disable`. */
export interface DisableServerPayload {
  disabledReason?: string;
}

/** Body for `PATCH /api/servers/:id` — everything from create except `guildId`, `isActive`, and `disabledReason`. */
export type UpdateServerPayload = Partial<
  Pick<
    CreateServerPayload,
    'name' | 'icon' | 'type' | 'isMain' | 'syncFrequencyHours' | 'defaultPermissionPolicy'
  >
>;
