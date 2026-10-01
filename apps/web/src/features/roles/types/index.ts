/** Permission catalog entry — derived from the backend's seeded Discord permissions. */
export interface PermissionCatalogEntry {
  id: number;
  key: string;
  description: string;
}

/** All 49 Discord permissions seeded in the backend database (IDs 1–49). */
export const PERMISSION_CATALOG: readonly PermissionCatalogEntry[] = [
  { id: 1, key: 'CREATE_INSTANT_INVITE', description: 'Allows creation of instant invites' },
  { id: 2, key: 'KICK_MEMBERS', description: 'Allows kicking members' },
  { id: 3, key: 'BAN_MEMBERS', description: 'Allows banning members' },
  {
    id: 4,
    key: 'ADMINISTRATOR',
    description: 'Grants all permissions, bypasses channel permission overwrites',
  },
  { id: 5, key: 'MANAGE_CHANNELS', description: 'Allows management and editing of channels' },
  { id: 6, key: 'MANAGE_GUILD', description: 'Allows management and editing of the guild' },
  { id: 7, key: 'ADD_REACTIONS', description: 'Allows adding reactions to messages' },
  { id: 8, key: 'VIEW_AUDIT_LOG', description: 'Allows viewing of the audit log' },
  {
    id: 9,
    key: 'PRIORITY_SPEAKER',
    description: 'Allows using priority speaker in a voice channel',
  },
  { id: 10, key: 'STREAM', description: 'Allows the user to go live' },
  { id: 11, key: 'VIEW_CHANNEL', description: 'Allows viewing channels' },
  { id: 12, key: 'SEND_MESSAGES', description: 'Allows sending messages in text channels' },
  { id: 13, key: 'SEND_TTS_MESSAGES', description: 'Allows sending /tts messages' },
  { id: 14, key: 'MANAGE_MESSAGES', description: 'Allows deletion and pinning of messages' },
  { id: 15, key: 'EMBED_LINKS', description: 'Links sent will have embedded content' },
  { id: 16, key: 'ATTACH_FILES', description: 'Allows uploading images and files' },
  { id: 17, key: 'READ_MESSAGE_HISTORY', description: 'Allows reading message history' },
  {
    id: 18,
    key: 'MENTION_EVERYONE',
    description: 'Allows using @everyone, @here, and all role mentions',
  },
  {
    id: 19,
    key: 'USE_EXTERNAL_EMOJIS',
    description: 'Allows using custom emojis from other servers',
  },
  { id: 20, key: 'VIEW_GUILD_INSIGHTS', description: 'Allows viewing guild insights' },
  { id: 21, key: 'CONNECT', description: 'Allows connecting to voice channels' },
  { id: 22, key: 'SPEAK', description: 'Allows speaking in voice channels' },
  { id: 23, key: 'MUTE_MEMBERS', description: 'Allows muting members in voice channels' },
  { id: 24, key: 'DEAFEN_MEMBERS', description: 'Allows deafening members in voice channels' },
  { id: 25, key: 'MOVE_MEMBERS', description: 'Allows moving members between voice channels' },
  {
    id: 26,
    key: 'USE_VAD',
    description: 'Allows using voice-activity-detection in voice channels',
  },
  { id: 27, key: 'CHANGE_NICKNAME', description: 'Allows changing own nickname' },
  { id: 28, key: 'MANAGE_NICKNAMES', description: 'Allows changing other members nicknames' },
  { id: 29, key: 'MANAGE_ROLES', description: 'Allows management and editing of roles' },
  { id: 30, key: 'MANAGE_WEBHOOKS', description: 'Allows management and editing of webhooks' },
  {
    id: 31,
    key: 'MANAGE_GUILD_EXPRESSIONS',
    description: 'Allows management of emojis, stickers, and soundboard sounds',
  },
  { id: 32, key: 'USE_APPLICATION_COMMANDS', description: 'Allows using slash commands' },
  { id: 33, key: 'REQUEST_TO_SPEAK', description: 'Allows requesting to speak in stage channels' },
  { id: 34, key: 'MANAGE_EVENTS', description: 'Allows management of scheduled events' },
  { id: 35, key: 'MANAGE_THREADS', description: 'Allows deleting and archiving threads' },
  { id: 36, key: 'CREATE_PUBLIC_THREADS', description: 'Allows creating public threads' },
  { id: 37, key: 'CREATE_PRIVATE_THREADS', description: 'Allows creating private threads' },
  { id: 38, key: 'USE_EXTERNAL_STICKERS', description: 'Allows using stickers from other servers' },
  { id: 39, key: 'SEND_MESSAGES_IN_THREADS', description: 'Allows sending messages in threads' },
  {
    id: 40,
    key: 'USE_EMBEDDED_ACTIVITIES',
    description: 'Allows using Activities in voice channels',
  },
  { id: 41, key: 'MODERATE_MEMBERS', description: 'Allows timing out members' },
  {
    id: 42,
    key: 'VIEW_CREATOR_MONETIZATION_ANALYTICS',
    description: 'Allows viewing role subscription insights',
  },
  { id: 43, key: 'USE_SOUNDBOARD', description: 'Allows using the soundboard in voice channels' },
  {
    id: 44,
    key: 'CREATE_GUILD_EXPRESSIONS',
    description: 'Allows creating emojis, stickers, and soundboard sounds',
  },
  { id: 45, key: 'CREATE_EVENTS', description: 'Allows creating scheduled events' },
  {
    id: 46,
    key: 'USE_EXTERNAL_SOUNDS',
    description: 'Allows using external sounds in the soundboard',
  },
  { id: 47, key: 'SEND_VOICE_MESSAGES', description: 'Allows sending voice messages' },
  { id: 48, key: 'SEND_POLLS', description: 'Allows sending polls' },
  { id: 49, key: 'USE_EXTERNAL_APPS', description: 'Allows using external apps in a server' },
] as const;

/** Response shape from `GET /api/admin/stats/roles?serverId=X`. */
export interface RoleStatsItem {
  roleId: string;
  roleName: string;
  memberCount: number;
  percentage: number;
  hierarchyLevel: number | null;
  color: number | null;
  isGlobal?: boolean;
}

export interface RoleStatsResponse {
  serverId: string;
  serverName: string;
  roles: RoleStatsItem[];
  totalMembers: number;
}

/** Permission item returned from role-permissions endpoints. */
export interface PermissionItem {
  id: number;
  key: string;
  description?: string;
}

/** Response shape from `GET /permissions/admin/servers/:serverId/roles/:roleId/permissions`. */
export interface RolePermissionsResponse {
  roleId: string;
  roleName: string;
  serverId: string;
  permissions: PermissionItem[];
}

/** Request body for `POST /permissions/admin/servers/:serverId/roles/:roleId/permissions`. */
export interface AssignPermissionsPayload {
  permissionIds: number[];
}

/** Response shape from `POST /permissions/admin/servers/:serverId/roles/:roleId/impact`. */
export interface ImpactPreviewResponse {
  affectedMembers: number;
  memberIds: string[];
  roleHolders: number;
}

/** Request body for impact preview. */
export interface ImpactPreviewPayload {
  permissionIds: number[];
  action: 'add' | 'remove';
}

/** An inheritance rule from `GET /permissions/inheritance-rules`. */
export interface InheritanceRule {
  id: number;
  sourceRoleId: string;
  targetScope: 'all' | 'selected';
  enabled: boolean;
  updatedAt: string;
  targetServerIds: string[];
}

/** Request body for `POST /permissions/inheritance-rules`. */
export interface CreateInheritanceRulePayload {
  sourceRoleId: string;
  enabled?: boolean;
  targetScope: 'all' | 'selected';
  targetServerIds?: string[];
}

/** List-inheritance-rules query params. */
export interface ListInheritanceRulesParams {
  sourceRoleId?: string;
  enabled?: boolean;
  targetScope?: 'all' | 'selected';
  serverId?: string;
}
