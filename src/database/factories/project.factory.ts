import { faker } from '@faker-js/faker';
import { projects } from '../entities/project.entity';

export const createProjectFactory = (
  overrides?: Partial<typeof projects.$inferInsert>,
) => {
  return {
    id: crypto.randomUUID(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    apiKey: faker.string.alphanumeric(32),
    apiKeyCreatedAt: new Date(),
    webhookUrl: faker.internet.url(),
    ...overrides,
  };
};
