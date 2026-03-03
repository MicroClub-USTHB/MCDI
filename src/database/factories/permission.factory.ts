import { faker } from '@faker-js/faker';
import { permissions } from '../entities/permission.entity';

export const createPermissionFactory = (
  overrides?: Partial<typeof permissions.$inferInsert>,
) => {
  return {
    key: faker.lorem.words(2).toUpperCase().replace(/\s+/g, '_'),
    description: faker.lorem.sentence(),
    bitfield: BigInt(faker.number.int({ min: 1, max: 1000000 })),
    ...overrides,
  };
};
