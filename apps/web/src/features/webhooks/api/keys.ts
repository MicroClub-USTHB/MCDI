export const webhookKeys = {
  all: ['webhooks'] as const,
  lists: (projectId: string) => [...webhookKeys.all, 'list', projectId] as const,
};
