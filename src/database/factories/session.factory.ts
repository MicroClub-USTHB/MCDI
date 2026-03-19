import { faker } from '@faker-js/faker';
import { sessions } from '../entities/session.entity';
import { hashSessionToken } from '@/common/utils/session-token.util';

export const createSessionFactory = (
  memberId: string,
  overrides?: Partial<typeof sessions.$inferInsert>,
) => {
  const rawToken = faker.string.alphanumeric(64);
  return {
    id: crypto.randomUUID(),
    memberId: memberId,
    token: hashSessionToken(rawToken),
    expiresAt: faker.date.future(),
    ...overrides,
  };
};
