export const roles = {
  name: 'Roles',
  route: '/dashboard/roles',
} as const;

export * from './api/keys';
export * from './api/queries';
export * from './api/mutations';
export * from './api/mappers';
export {
  fetchRoleStats,
  fetchRolePermissions,
  addPermissionsToRole,
  removePermissionFromRole,
  fetchImpactPreview,
  fetchInheritanceRules,
  createInheritanceRule,
} from './api/service';
export * from './components';
export { PERMISSION_CATALOG } from './types';
export type {
  PermissionCatalogEntry,
  RoleStatsItem,
  RoleStatsResponse,
  PermissionItem,
  RolePermissionsResponse,
  AssignPermissionsPayload,
  ImpactPreviewResponse,
  ImpactPreviewPayload,
  InheritanceRule,
  CreateInheritanceRulePayload,
  ListInheritanceRulesParams,
} from './types';
