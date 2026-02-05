import { rolePermissions } from '../entities/role-permission.entity';

export const createRolePermissionFactory = (
  roleId: string,
  permissionId: number,
  overrides?: Partial<typeof rolePermissions.$inferInsert>,
) => {
  return {
    roleId: roleId,
    permissionId: permissionId,
    ...overrides,
  };
};
