/**
 * The catalog of admin access, shared by the API and the admin panel. Every
 * admin endpoint declares one resource and one level from here.
 */
export const ACCESS_RESOURCES = [
  "servers",
  "members",
  "channels",
  "messages",
  "roles",
  "projects",
  "project_keys",
  "webhooks",
  "inbound_webhooks",
  "sync",
  "stats",
  "audit",
  "monitoring",
  "settings",
] as const;
export type AccessResource = (typeof ACCESS_RESOURCES)[number];

/** Ordered: each level includes everything below it. */
export const ACCESS_LEVELS = ["none", "read", "write", "manage"] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

/** A level a role can be granted. `none` exists only as a member override (a deny). */
export type GrantLevel = Exclude<AccessLevel, "none">;
export const GRANT_LEVELS: readonly GrantLevel[] = ["read", "write", "manage"];

const RANK: Record<AccessLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  manage: 3,
};

/** True when `effective` is at least `required` (none < read < write < manage). */
export function levelAtLeast(
  effective: AccessLevel,
  required: AccessLevel,
): boolean {
  return RANK[effective] >= RANK[required];
}

export function isAccessResource(value: unknown): value is AccessResource {
  return (
    typeof value === "string" &&
    (ACCESS_RESOURCES as readonly string[]).includes(value)
  );
}

export function isAccessLevel(value: unknown): value is AccessLevel {
  return (
    typeof value === "string" &&
    (ACCESS_LEVELS as readonly string[]).includes(value)
  );
}

export function isGrantLevel(value: unknown): value is GrantLevel {
  return isAccessLevel(value) && value !== "none";
}
