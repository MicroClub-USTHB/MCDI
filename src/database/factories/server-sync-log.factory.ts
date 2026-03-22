import { faker } from '@faker-js/faker';
import { serverSyncLogs } from '../entities/server-sync-log.entity';

export const createServerSyncLogFactory = (
  serverId: string,
  overrides?: Partial<typeof serverSyncLogs.$inferInsert>,
) => {
  return {
    serverId: serverId,
    status: faker.helpers.arrayElement([
      'queued',
      'in_progress',
      'success',
      'failed',
    ]),
    syncType: faker.helpers.arrayElement(['full', 'incremental', 'manual']),
    target: faker.helpers.arrayElement(['all', 'members', 'roles']),
    membersSynced: faker.number.int({ min: 0, max: 1000 }),
    rolesSynced: faker.number.int({ min: 0, max: 50 }),
    message: faker.lorem.sentence(),
    startedAt: faker.date.recent(),
    heartbeatAt: faker.datatype.boolean() ? faker.date.recent() : null,
    finishedAt: faker.date.recent(),
    ...overrides,
  };
};
