import { z } from 'zod';

import { parseDateOnly } from '../lib/date.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../lib/pagination.js';

export const objectId = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'This is not a valid identifier.');

export const idParam = z.object({ id: objectId });

export const dateOnlyString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the form YYYY-MM-DD, for example 2026-07-29.')
  .transform((value) => parseDateOnly(value));

export const optionalDateOnly = dateOnlyString.optional();

export const nullableDateOnly = z
  .union([dateOnlyString, z.null()])
  .optional();

export const booleanQuery = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');

export const optionalBooleanQuery = booleanQuery.optional();

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export const searchTerm = z.string().trim().min(1).max(200).optional();

export const sortParam = z
  .string()
  .regex(/^[a-zA-Z]+:(asc|desc)$/, 'Sort looks like field:asc or field:desc.')
  .optional();

export const trimmedString = (min: number, max: number) =>
  z.string().trim().min(min, `Use at least ${min} character${min === 1 ? '' : 's'}.`).max(
    max,
    `Keep this under ${max} characters.`,
  );

export const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max, `Keep this under ${max} characters.`), z.null()])
    .optional();

export const emailAddress = z.email('Enter a complete email address.').trim().toLowerCase();

export const DEFAULT_PAGE = { page: 1, limit: DEFAULT_PAGE_SIZE } as const;
