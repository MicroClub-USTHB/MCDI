import type { AccessLevel, AccessResource, GrantLevel } from '@mcdi/contracts';

export interface CatalogEntryDto<K extends string> {
  key: K;
  description: string;
}

export interface AccessCatalogDto {
  resources: CatalogEntryDto<AccessResource>[];
  levels: CatalogEntryDto<AccessLevel>[];
}

/** A resource missing from the map has no grant. */
export type RoleGrantsDto = Partial<Record<AccessResource, GrantLevel>>;

export interface AccessRoleDto {
  id: string;
  name: string;
  position: number | null;
  /** A root role holds full access and cannot be edited. */
  root: boolean;
  grants: RoleGrantsDto;
}

/** A resource missing from the map is inherited from the member's roles. */
export type MemberOverridesMap = Partial<Record<AccessResource, AccessLevel>>;

export interface MemberOverridesDto {
  memberId: string;
  overrides: MemberOverridesMap;
}

export type EffectiveSourceDto =
  { type: 'root' } | { type: 'override' } | { type: 'role'; roleId: string } | { type: 'none' };

export interface MemberEffectiveDto {
  memberId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  root: boolean;
  access: Record<AccessResource, { level: AccessLevel; source: EffectiveSourceDto }>;
}

export interface OverrideMemberDto {
  memberId: string;
  username: string;
  displayName: string;
  avatar: string | null;
  /** True when the member holds a root role now, so the overrides are inactive. */
  root: boolean;
  overrides: MemberOverridesMap;
}

export interface OverridesListDto {
  members: OverrideMemberDto[];
}
