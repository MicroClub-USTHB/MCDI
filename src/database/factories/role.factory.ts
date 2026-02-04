import { faker } from '@faker-js/faker';
import { roles } from '../entities/role.entity';

export const createRoleFactory = (
  serverId: string,
  overrides?: Partial<typeof roles.$inferInsert>,
) => {
  return {
    id: faker.string.numeric(18),
    serverId: serverId,
    name: faker.helpers.arrayElement([
      'Admin',
      'Lead',
      'Member',
      'Guest',
      'Bot',
    ]),
    color: faker.number.int({ min: 0, max: 0xffffff }),
    hoist: faker.datatype.boolean(),
    position: faker.number.int({ min: 1, max: 10 }),
    managed: false,
    mentionable: faker.datatype.boolean(),
    ...overrides,
  };
};
