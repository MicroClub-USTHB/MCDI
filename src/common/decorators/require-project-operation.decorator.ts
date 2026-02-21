import { SetMetadata } from '@nestjs/common';
import type { ProjectServerOperation } from '../../modules/projects/projects-access.types';

export const PROJECT_OPERATION_KEY = 'project_operation';

export const RequireProjectOperation = (operation: ProjectServerOperation) =>
  SetMetadata(PROJECT_OPERATION_KEY, operation);
