export const channelKeys = {
  all: ['channels'] as const,
  lists: (serverId: string) => [...channelKeys.all, 'list', serverId] as const,
  detail: (serverId: string, channelId: string) =>
    [...channelKeys.all, 'detail', serverId, channelId] as const,
  messages: (serverId: string, channelId: string) =>
    [...channelKeys.all, 'messages', serverId, channelId] as const,
};
