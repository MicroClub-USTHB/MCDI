import { faker } from '@faker-js/faker';
import { members } from '../entities/member.entity';

export const createMemberFactory = (
  overrides?: Partial<typeof members.$inferInsert>,
) => {
  return {
    id: faker.string.numeric(18),
    username: faker.internet.username(),
    globalName: faker.person.fullName(),
    displayName: faker.person.fullName(),
    avatar: faker.image.avatar(),
    email: faker.internet.email(),
    isClubMember: faker.datatype.boolean(),
    joinedAt: faker.date.past(),
    syncedAt: new Date(),
    ...overrides,
  };
};
