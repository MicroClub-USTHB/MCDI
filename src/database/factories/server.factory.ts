import { faker } from '@faker-js/faker';
import { servers } from '../entities/server.entity';

export const createServerFactory = (
  overrides?: Partial<typeof servers.$inferInsert>,
) => {
  return {
    id: faker.string.numeric(18),
    name: faker.company.name() + ' Discord',
    icon: faker.image.url(),
    isMain: false,
    type: 'other',
    isActive: true,
    syncedAt: new Date(),
    ...overrides,
  };
};
