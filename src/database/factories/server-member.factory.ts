import { faker } from '@faker-js/faker';
import { serverMembers } from '../entities/server-member.entity';

export const createServerMemberFactory = (
  serverId: string,
  memberId: string,
  overrides?: Partial<typeof serverMembers.$inferInsert>,
) => {
  return {
    serverId: serverId,
    memberId: memberId,
    joinedAt: faker.date.past(),
    ...overrides,
  };
};
