import { validationFailed } from './errors.js';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface PageRequest {
  page: number;
  limit: number;
  skip: number;
}

export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const toPageRequest = (page = 1, limit = DEFAULT_PAGE_SIZE): PageRequest => {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), MAX_PAGE_SIZE);
  const safePage = Math.max(Math.trunc(page), 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
};

export const buildPageMeta = (total: number, request: PageRequest): PageMeta => ({
  total,
  page: request.page,
  limit: request.limit,
  totalPages: Math.max(Math.ceil(total / request.limit), 1),
});

export type SortDirection = 1 | -1;

export const parseSort = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: Record<string, SortDirection>,
): Record<string, SortDirection> => {
  if (!value) return fallback;
  const [field, direction = 'asc'] = value.split(':');
  if (!field || !allowed.includes(field as T)) {
    throw validationFailed(`You cannot sort by "${field ?? ''}" on this list.`, [
      { field: 'sort', message: `Sort by one of: ${allowed.join(', ')}.` },
    ]);
  }
  if (direction !== 'asc' && direction !== 'desc') {
    throw validationFailed('Sort direction must be asc or desc.', [
      { field: 'sort', message: 'Use field:asc or field:desc.' },
    ]);
  }
  return { [field]: direction === 'asc' ? 1 : -1 };
};

export const withTiebreak = (
  sort: Record<string, SortDirection>,
): Record<string, SortDirection> => ('_id' in sort ? sort : { ...sort, _id: -1 });
