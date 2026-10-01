export const monitoring = {
  name: 'Monitoring',
  route: '/dashboard/monitoring',
} as const;

export {
  useApiUsageQuery,
  useAuditLogsQuery,
  useAuthFailuresQuery,
  useSystemHealthQuery,
} from './api/queries';
export { useExportAuditLogsMutation } from './api/mutations';
export type * from './types';
