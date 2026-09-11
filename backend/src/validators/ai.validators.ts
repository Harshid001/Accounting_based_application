import { z } from 'zod';

import { trimmedString } from './common.validators.js';

export const aiChatBody = z
  .object({
    message: trimmedString(0, 4000).default(''),
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
    image: z
      .object({
        dataUrl: z.string().max(10_000_000),
        mimeType: z.string().max(100).optional(),
      })
      .nullable()
      .optional(),
    file: z
      .object({
        dataUrl: z.string().max(10_000_000),
        name: z.string().max(300).optional(),
        mimeType: z.string().max(100).optional(),
        size: z.number().optional(),
        category: z.string().max(50).optional(),
      })
      .nullable()
      .optional(),
    files: z
      .array(
        z.object({
          dataUrl: z.string().max(10_000_000),
          name: z.string().max(300).optional(),
          mimeType: z.string().max(100).optional(),
          size: z.number().optional(),
          category: z.string().max(50).optional(),
        }),
      )
      .max(10)
      .optional(),
  })
  .refine(
    (data) =>
      (data.message !== undefined && data.message.trim().length > 0) ||
      Boolean(data.image?.dataUrl) ||
      Boolean(data.file?.dataUrl) ||
      Boolean(data.files && data.files.length > 0),
    { message: 'Provide either a message, an image, or an attached file.' },
  );

export type AiChatBody = z.infer<typeof aiChatBody>;

export const aiConfigBody = z
  .object({
    provider: z.enum(['gemini', 'openai', 'custom']).nullable().optional(),
    enabled: z.boolean().optional(),
    geminiApiKey: trimmedString(20, 400).nullable().optional(),
    geminiModel: trimmedString(1, 100).optional(),
    openaiApiKey: trimmedString(20, 400).nullable().optional(),
    openaiModel: trimmedString(1, 100).optional(),
    customApiKey: trimmedString(10, 400).nullable().optional(),
    customBaseUrl: z.string().trim().max(500).optional(),
    customModel: trimmedString(1, 100).optional(),
  })
  .refine(
    (body) =>
      body.provider !== undefined ||
      body.enabled !== undefined ||
      body.geminiApiKey !== undefined ||
      body.geminiModel !== undefined ||
      body.openaiApiKey !== undefined ||
      body.openaiModel !== undefined ||
      body.customApiKey !== undefined ||
      body.customBaseUrl !== undefined ||
      body.customModel !== undefined,
    { message: 'Provide at least one AI configuration field to update.' },
  );

export type AiConfigBody = z.infer<typeof aiConfigBody>;

export const aiModelsBody = z.object({
  provider: z.enum(['gemini', 'openai', 'custom']),
  apiKey: trimmedString(10, 400).optional(),
  baseUrl: z.string().trim().max(500).optional(),
});

export type AiModelsBody = z.infer<typeof aiModelsBody>;
