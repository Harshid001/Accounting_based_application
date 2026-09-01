import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants';
import type { QueryParams } from '@/types/api';

export interface ActiveFilter {
  key: string;
  label: string;
  value: string;
}

export interface ListParamsConfig {
  filterKeys: readonly string[];
  defaultSort?: string;
  defaultLimit?: number;
  labels?: Record<string, string>;
  valueLabels?: Record<string, Record<string, string>>;
}

export interface ListParams {
  page: number;
  limit: number;
  sort: string | null;
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
  search: string;
  filters: Record<string, string>;
  query: QueryParams;
  activeFilters: ActiveFilter[];
  hasFilters: boolean;
  setFilter: (key: string, value: string | null) => void;
  setFilters: (next: Record<string, string | null>) => void;
  setSearch: (value: string) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  toggleSort: (field: string) => void;
  clearFilters: () => void;
}

const clampInt = (raw: string | null, fallback: number, min: number, max: number): number => {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

export function useListParams(config: ListParamsConfig): ListParams {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filterKeys, defaultSort, defaultLimit = DEFAULT_PAGE_SIZE, labels, valueLabels } = config;

  const page = clampInt(searchParams.get('page'), 1, 1, 100_000);
  const limit = clampInt(searchParams.get('limit'), defaultLimit, 1, MAX_PAGE_SIZE);
  const sort = searchParams.get('sort') ?? defaultSort ?? null;
  const search = searchParams.get('q') ?? '';

  const filters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const key of filterKeys) {
      const value = searchParams.get(key);
      if (value !== null && value.length > 0) out[key] = value;
    }
    return out;
  }, [filterKeys, searchParams]);

  const [sortField, sortDirection] = useMemo<[string | null, 'asc' | 'desc']>(() => {
    if (sort === null) return [null, 'asc'];
    const [field, direction] = sort.split(':');
    return [field ?? null, direction === 'desc' ? 'desc' : 'asc'];
  }, [sort]);

  const commit = useCallback(
    (mutate: (params: URLSearchParams) => void, resetPage: boolean) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          mutate(next);
          if (resetPage) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setFilter = useCallback(
    (key: string, value: string | null) => {
      commit((params) => {
        if (value === null || value.length === 0) params.delete(key);
        else params.set(key, value);
      }, true);
    },
    [commit],
  );

  const setFilters = useCallback(
    (next: Record<string, string | null>) => {
      commit((params) => {
        for (const [key, value] of Object.entries(next)) {
          if (value === null || value.length === 0) params.delete(key);
          else params.set(key, value);
        }
      }, true);
    },
    [commit],
  );

  const setSearch = useCallback(
    (value: string) => {
      setFilter('q', value.trim().length === 0 ? null : value);
    },
    [setFilter],
  );

  const setPage = useCallback(
    (next: number) => {
      commit((params) => {
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
      }, false);
    },
    [commit],
  );

  const setLimit = useCallback(
    (next: number) => {
      commit((params) => {
        if (next === defaultLimit) params.delete('limit');
        else params.set('limit', String(next));
      }, true);
    },
    [commit, defaultLimit],
  );

  const toggleSort = useCallback(
    (field: string) => {
      const nextDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
      commit((params) => {
        params.set('sort', `${field}:${nextDirection}`);
      }, true);
    },
    [commit, sortField, sortDirection],
  );

  const clearFilters = useCallback(() => {
    commit((params) => {
      params.delete('q');
      for (const key of filterKeys) params.delete(key);
    }, true);
  }, [commit, filterKeys]);

  const activeFilters = useMemo<ActiveFilter[]>(() => {
    const out: ActiveFilter[] = [];
    if (search.length > 0) out.push({ key: 'q', label: 'Search', value: search });
    for (const [key, value] of Object.entries(filters)) {
      out.push({
        key,
        label: labels?.[key] ?? key,
        value: valueLabels?.[key]?.[value] ?? value,
      });
    }
    return out;
  }, [search, filters, labels, valueLabels]);

  const query = useMemo<QueryParams>(() => {
    const out: QueryParams = { page, limit };
    if (sort !== null) out.sort = sort;
    if (search.length > 0) out.q = search;
    for (const [key, value] of Object.entries(filters)) out[key] = value;
    return out;
  }, [page, limit, sort, search, filters]);

  return {
    page,
    limit,
    sort,
    sortField,
    sortDirection,
    search,
    filters,
    query,
    activeFilters,
    hasFilters: activeFilters.length > 0,
    setFilter,
    setFilters,
    setSearch,
    setPage,
    setLimit,
    toggleSort,
    clearFilters,
  };
}
