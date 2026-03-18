import { SetMetadata } from '@nestjs/common';
import type { ProjectServerOperation } from '../../modules/projects/projects.repository';

export const PROJECT_OPERATION_KEY = 'project_operation';

export const RequireProjectOperation = (operation: ProjectServerOperation) =>
  SetMetadata(PROJECT_OPERATION_KEY, operation);
