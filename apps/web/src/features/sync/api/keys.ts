export const syncKeys = {
  all: ['sync'] as const,
  statuses: () => [...syncKeys.all, 'status'] as const,
  statusAll: () => [...syncKeys.all, 'status', 'all'] as const,
  status: (serverId: string) => [...syncKeys.all, 'status', serverId] as const,
  logs: (serverId: string, page: number) => [...syncKeys.all, 'logs', serverId, page] as const,
  changes: (syncLogId: number, page: number) =>
    [...syncKeys.all, 'changes', syncLogId, page] as const,
};
