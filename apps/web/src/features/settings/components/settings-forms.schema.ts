import { z } from 'zod';

// Bounds mirror the backend's UpdateSettingsDto (validated again there —
// this only gives the user a faster, inline version of the same rejection).
const ONE_SECOND_MS = 1_000;
const ONE_DAY_MS = 86_400_000;

export const cacheSettingsSchema = z.object({
  permissionTtlMs: z
    .number()
    .int('Must be a whole number')
    .min(ONE_SECOND_MS, 'Must be at least 1,000 ms')
    .max(ONE_DAY_MS, 'Must be at most 86,400,000 ms'),
  statsTtlMs: z
    .number()
    .int('Must be a whole number')
    .min(ONE_SECOND_MS, 'Must be at least 1,000 ms')
    .max(ONE_DAY_MS, 'Must be at most 86,400,000 ms'),
});

export type CacheSettingsFormValues = z.infer<typeof cacheSettingsSchema>;
export type CacheSettingsFormErrors = Partial<Record<keyof CacheSettingsFormValues, string>>;

export const rateLimitSettingsSchema = z.object({
  maxWebhooksPerProject: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1')
    .max(1000, 'Must be at most 1,000'),
});

export type RateLimitSettingsFormValues = z.infer<typeof rateLimitSettingsSchema>;
export type RateLimitSettingsFormErrors = Partial<
  Record<keyof RateLimitSettingsFormValues, string>
>;

export const preferencesSettingsSchema = z.object({
  memberActivityThresholdDays: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Must be at most 3,650 days'),
});

export type PreferencesSettingsFormValues = z.infer<typeof preferencesSettingsSchema>;
export type PreferencesSettingsFormErrors = Partial<
  Record<keyof PreferencesSettingsFormValues, string>
>;
