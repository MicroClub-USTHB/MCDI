import { SetMetadata } from '@nestjs/common';

export const SCOPE_KEY = 'required_scope';
export const RequireScope = (scope: string) => SetMetadata(SCOPE_KEY, scope);
