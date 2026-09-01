import { z } from 'zod';

export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Write a message before sending.')
    .max(8000, 'Keep a message under 8000 characters.'),
});

export type MessageValues = z.infer<typeof messageSchema>;
