import { faker } from '@faker-js/faker';
import { sessions } from '../entities/session.entity';

export const createSessionFactory = (
  memberId: string,
  overrides?: Partial<typeof sessions.$inferInsert>,
) => {
  return {
    id: crypto.randomUUID(),
    memberId: memberId,
    token: faker.string.alphanumeric(64),
    expiresAt: faker.date.future(),
    ...overrides,
  };
};
