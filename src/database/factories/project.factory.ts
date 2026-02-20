import { faker } from '@faker-js/faker';
import { createHash, randomBytes } from 'crypto';
import { projects } from '../entities/project.entity';

/** Generates a fake but structurally valid API key pair for seeding. */
function fakeApiKeyPair() {
  const prefixId = randomBytes(4).toString('hex');       // 8 hex chars
  const secret   = randomBytes(32).toString('hex');      // 64 hex chars
  const prefix   = `mcdi_pk_live_${prefixId}`;
  const hash     = createHash('sha256').update(secret).digest('hex');
  return { prefix, hash };
}

export const createProjectFactory = (
  overrides?: Partial<typeof projects.$inferInsert>,
) => {
  const { prefix, hash } = fakeApiKeyPair();

  return {
    id: crypto.randomUUID(),
    name: faker.commerce.productName(),
    description: faker.commerce.productDescription(),
    apiKeyHash: hash,
    apiKeyPrefix: prefix,
    apiKeyCreatedAt: new Date(),
    isActive: true,
    ...overrides,
  };
};
