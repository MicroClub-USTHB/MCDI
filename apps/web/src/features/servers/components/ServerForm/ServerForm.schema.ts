import { z } from 'zod';

export const createServerSchema = z.object({
  guildId: z.string().regex(/^\d{17,20}$/, 'Must be a 17-20 digit Discord ID'),
  name: z.string().trim().optional(),
  type: z.enum(['main', 'competition', 'event', 'other']),
  isMain: z.boolean(),
  syncFrequencyHours: z
    .number()
    .int('Must be a whole number')
    .min(1, 'Must be at least 1 hour')
    .max(24, 'Must be at most 24 hours'),
  defaultPermissionPolicy: z.enum(['deny_all', 'allow_all', 'custom']),
});

export type CreateServerFormValues = z.infer<typeof createServerSchema>;

export type CreateServerFormErrors = Partial<Record<keyof CreateServerFormValues, string>>;
