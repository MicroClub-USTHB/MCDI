export const projects = {
  name: 'Projects',
  route: '/dashboard/projects',
} as const;

export * from './api/keys';
export * from './api/queries';
export * from './api/mutations';
export * from './api/mappers';
export {
  fetchProjects,
  fetchProject,
  createProject,
  updateProject,
  deleteProject,
  fetchApiKeyInfo,
  deactivateProject,
  reactivateProject,
  regenerateApiKey,
  updateRedirectUri,
  setServerAccess,
  revokeServerAccess,
  fetchAccessMatrix,
  fetchAccessAudit,
} from './api/service';
export type {
  ListProjectsParams,
  ListAccessMatrixParams,
  ListAccessAuditParams,
} from './api/service';
export * from './components';
export type {
  ProjectScope,
  ProjectOperation,
  AccessOperations,
  ProjectDto,
  ProjectServerAccessDto,
  CreateProjectPayload,
  UpdateProjectPayload,
  SetServerAccessPayload,
  CreateProjectResponse,
  RegenerateApiKeyResponse,
  ApiKeyInfoDto,
  AccessAuditAction,
  AccessAuditEntry,
  AccessMatrixEntry,
  ProjectFormValues,
} from './types';
