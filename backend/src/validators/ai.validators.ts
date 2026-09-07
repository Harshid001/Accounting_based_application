import { z } from 'zod';

import { trimmedString } from './common.validators.js';

export const aiChatBody = z.object({
  message: trimmedString(1, 4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(30)
    .default([]),
  currentRoute: z.string().trim().max(200).nullable().optional(),
});

export type AiChatBody = z.infer<typeof aiChatBody>;

export const aiConfigBody = z
  .object({
    provider: z.enum(['gemini', 'openai']).nullable().optional(),
    enabled: z.boolean().optional(),
    geminiApiKey: trimmedString(20, 400).nullable().optional(),
    geminiModel: trimmedString(1, 100).optional(),
    openaiApiKey: trimmedString(20, 400).nullable().optional(),
    openaiModel: trimmedString(1, 100).optional(),
  })
  .refine(
    (body) =>
      body.provider !== undefined ||
      body.enabled !== undefined ||
      body.geminiApiKey !== undefined ||
      body.geminiModel !== undefined ||
      body.openaiApiKey !== undefined ||
      body.openaiModel !== undefined,
    { message: 'Provide at least one AI configuration field to update.' },
  );

export type AiConfigBody = z.infer<typeof aiConfigBody>;

export const aiModelsBody = z.object({
  provider: z.enum(['gemini', 'openai']),
  apiKey: trimmedString(10, 400).optional(),
});

export type AiModelsBody = z.infer<typeof aiModelsBody>;
