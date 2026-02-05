import { serverMemberRoles } from '../entities/server-member-role.entity';

export const createServerMemberRoleFactory = (
  memberId: string,
  roleId: string,
  overrides?: Partial<typeof serverMemberRoles.$inferInsert>,
) => {
  return {
    memberId: memberId,
    roleId: roleId,
    ...overrides,
  };
};
