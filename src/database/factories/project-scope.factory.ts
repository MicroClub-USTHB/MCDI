import { projectScopes } from '../entities/project-scope.entity';
import { ProjectScope } from '../../modules/projects/dto/create-project.dto';

export const createProjectScopeFactory = (
  projectId: string,
  scope: ProjectScope,
  overrides?: Partial<typeof projectScopes.$inferInsert>,
) => {
  return {
    id: crypto.randomUUID(),
    projectId,
    scope,
    ...overrides,
  };
};

/** Creates scope rows for all available scopes for a given project. */
export const createAllScopesFactory = (projectId: string) => {
  return Object.values(ProjectScope).map((scope) =>
    createProjectScopeFactory(projectId, scope),
  );
};
