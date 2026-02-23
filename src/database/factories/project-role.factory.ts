import { projectRoles } from '../entities/project-role.entity';

export const createProjectRoleFactory = (
  projectId: string,
  roleId: string,
) => {
  return {
    projectId,
    roleId,
  };
};
