import { projectServers } from '../entities/project-server.entity';

export const createProjectServerFactory = (
  projectId: string,
  serverId: string,
  overrides?: Partial<typeof projectServers.$inferInsert>,
) => {
  return {
    projectId: projectId,
    serverId: serverId,
    operations: {
      READ: true,
      SEND_MESSAGES: false,
      MANAGE_WEBHOOKS: false,
    },
    scopes: [],
    ...overrides,
  };
};
