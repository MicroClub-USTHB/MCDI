export { apiClient, ApiClient } from '@/shared/lib/api-client';
export { env } from '@/shared/lib/env';
export { cn } from '@/shared/lib/utils';
export type { ApiResponse, ApiError, PaginatedResponse, User } from '@/shared/types';

export { authKeys } from './keys';
export {
  getDiscordOAuthUrl,
  fetchCurrentAdmin,
  logoutAdmin,
  rememberPostLoginRedirect,
  consumePostLoginRedirect,
} from './service';
export { mapAdminProfileToUser } from './mappers';
export { useCurrentAdminQuery } from './queries';
export { useLogoutMutation } from './mutations';
