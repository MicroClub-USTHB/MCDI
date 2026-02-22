import type { ProjectServerOperations } from '../../database/entities/project-server.entity';

export const PROJECT_SERVER_OPERATION_VALUES = [
  'READ',
  'SEND_MESSAGES',
  'MANAGE_WEBHOOKS',
] as const;

export type ProjectServerOperation =
  (typeof PROJECT_SERVER_OPERATION_VALUES)[number];

export const DEFAULT_PROJECT_SERVER_OPERATIONS: ProjectServerOperations = {
  READ: true,
  SEND_MESSAGES: false,
  MANAGE_WEBHOOKS: false,
};

export const isProjectServerOperation = (
  value: string,
): value is ProjectServerOperation =>
  PROJECT_SERVER_OPERATION_VALUES.includes(value as ProjectServerOperation);
