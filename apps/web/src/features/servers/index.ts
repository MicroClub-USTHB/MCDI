export const servers = {
  name: 'Servers',
  route: '/dashboard/servers',
} as const;

export { serverKeys } from './api/keys';
export {
  fetchServers,
  fetchServer,
  createServer,
  updateServer,
  disableServer,
  enableServer,
  deleteServer,
} from './api/service';
export { useServersQuery, useServerQuery } from './api/queries';
export {
  useCreateServerMutation,
  useUpdateServerMutation,
  useDisableServerMutation,
  useEnableServerMutation,
  useDeleteServerMutation,
} from './api/mutations';
export type {
  ServerListItemDto,
  ServerDto,
  ServerType,
  PermissionPolicy,
  CreateServerPayload,
  UpdateServerPayload,
  DisableServerPayload,
} from './types';
export * from './components';
