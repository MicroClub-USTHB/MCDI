import { randomBytes } from 'node:crypto';
import type { KeyProvider } from '../crypto-store.js';

/** A key provider that always uses one in-memory key, as if it came from the keychain. */
export const fixedKeys = (key: Buffer = randomBytes(32)): KeyProvider => ({
  keyForWrite: async () => ({ source: 'keychain', key }),
  keyFor: async () => key,
});
