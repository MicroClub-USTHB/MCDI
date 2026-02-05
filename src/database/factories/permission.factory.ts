import { faker } from '@faker-js/faker';
import { permissions } from '../entities/permission.entity';

export const createPermissionFactory = (
  overrides?: Partial<typeof permissions.$inferInsert>,
) => {
  return {
    name: faker.lorem.words(2),
    description: faker.lorem.sentence(),
    code: faker.string.alpha(10).toUpperCase(),
    bitfield: BigInt(faker.number.int({ min: 1, max: 1000000 })),
    ...overrides,
  };
};
