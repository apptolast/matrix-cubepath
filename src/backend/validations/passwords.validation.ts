import { z } from 'zod';

export const passwordMasterBody = z.object({
  masterPassword: z.string().min(8),
});

const passwordEntryFields = z.object({
  label: z.string().min(1),
  domain: z.string().optional(),
  username: z.string().optional(),
  password: z.string().min(1),
  category: z.enum(['email', 'social', 'dev', 'finance', 'gaming', 'work', 'other']).default('other'),
  favorite: z.number().min(0).max(1).default(0),
  notes: z.string().optional(),
});

export const passwordCreateBody = passwordEntryFields;
export const passwordUpdateBody = passwordEntryFields.partial();

export const passwordImportConfirmBody = z.object({
  entries: z.array(passwordEntryFields.omit({ favorite: true })),
});

export const passwordBulkDeleteBody = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export const passwordChangeMasterBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const passwordImportParseBody = z.object({
  content: z
    .string()
    .min(1)
    .max(10 * 1024 * 1024),
});
