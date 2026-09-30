import { describe, expect, it } from 'vitest';

import {
  cacheSettingsSchema,
  preferencesSettingsSchema,
  rateLimitSettingsSchema,
} from '@/features/settings/components/settings-forms.schema';

describe('cacheSettingsSchema', () => {
  it('accepts values within bounds', () => {
    const result = cacheSettingsSchema.safeParse({ permissionTtlMs: 300_000, statsTtlMs: 300_000 });
    expect(result.success).toBe(true);
  });

  it.each([
    ['permissionTtlMs', 999],
    ['statsTtlMs', 999],
  ])('rejects %s below 1,000 ms', (key, value) => {
    const result = cacheSettingsSchema.safeParse({
      permissionTtlMs: 300_000,
      statsTtlMs: 300_000,
      [key]: value,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a value above the one-day cap', () => {
    const result = cacheSettingsSchema.safeParse({
      permissionTtlMs: 86_400_001,
      statsTtlMs: 300_000,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer values', () => {
    const result = cacheSettingsSchema.safeParse({
      permissionTtlMs: 300_000.5,
      statsTtlMs: 300_000,
    });
    expect(result.success).toBe(false);
  });
});

describe('rateLimitSettingsSchema', () => {
  it('accepts a value within bounds', () => {
    expect(rateLimitSettingsSchema.safeParse({ maxWebhooksPerProject: 10 }).success).toBe(true);
  });

  it('rejects zero and below', () => {
    expect(rateLimitSettingsSchema.safeParse({ maxWebhooksPerProject: 0 }).success).toBe(false);
  });

  it('rejects above 1,000', () => {
    expect(rateLimitSettingsSchema.safeParse({ maxWebhooksPerProject: 1001 }).success).toBe(false);
  });
});

describe('preferencesSettingsSchema', () => {
  it('accepts a value within bounds', () => {
    expect(preferencesSettingsSchema.safeParse({ memberActivityThresholdDays: 30 }).success).toBe(
      true
    );
  });

  it('rejects zero and below', () => {
    expect(preferencesSettingsSchema.safeParse({ memberActivityThresholdDays: 0 }).success).toBe(
      false
    );
  });

  it('rejects above 3,650 days', () => {
    expect(preferencesSettingsSchema.safeParse({ memberActivityThresholdDays: 3651 }).success).toBe(
      false
    );
  });
});
