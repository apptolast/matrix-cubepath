import { z } from 'zod';

export const authRegisterBody = z.object({
  username: z.string().regex(/^[a-zA-Z0-9_-]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, _ or -'),
  password: z.string().min(8).max(128, 'Password must be between 8 and 128 characters'),
});

export const authLoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
