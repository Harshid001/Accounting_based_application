import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { useListParams } from '@/hooks/useListParams';

const FILTER_KEYS = ['status', 'clientType', 'archived'] as const;

const setup = (initial = '/clients') => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [initial] }, children);

  return renderHook(
    () => ({
      params: useListParams({
        filterKeys: FILTER_KEYS,
        defaultSort: 'displayName:asc',
        labels: { status: 'Status', clientType: 'Type', archived: 'Archived' },
        valueLabels: { status: { active: 'Active' } },
      }),
      location: useLocation(),
    }),
    { wrapper },
  );
};

describe('useListParams', () => {
  it('reads page, limit, sort, search and filters straight out of the URL', () => {
    const { result } = setup(
      '/clients?page=3&limit=50&sort=createdAt:desc&q=acme&status=active&archived=true',
    );

    expect(result.current.params.page).toBe(3);
    expect(result.current.params.limit).toBe(50);
    expect(result.current.params.sort).toBe('createdAt:desc');
    expect(result.current.params.sortField).toBe('createdAt');
    expect(result.current.params.sortDirection).toBe('desc');
    expect(result.current.params.search).toBe('acme');
    expect(result.current.params.filters).toEqual({ status: 'active', archived: 'true' });
  });

  it('reproduces the same view a pasted link describes, with no local state', () => {
    const url = '/clients?status=active&clientType=business&sort=status:asc&page=2';
    const first = setup(url);
    const second = setup(url);
    expect(first.result.current.params.query).toEqual(second.result.current.params.query);
  });

  it('falls back to the default sort and page when the URL says nothing', () => {
    const { result } = setup();
    expect(result.current.params.page).toBe(1);
    expect(result.current.params.sort).toBe('displayName:asc');
    expect(result.current.params.hasFilters).toBe(false);
  });

  it('writes a filter to the URL and resets the page', () => {
    const { result } = setup('/clients?page=4');

    act(() => {
      result.current.params.setFilter('status', 'active');
    });

    expect(result.current.location.search).toContain('status=active');
    expect(result.current.location.search).not.toContain('page=4');
    expect(result.current.params.page).toBe(1);
  });

  it('removes a filter when it is set to null', () => {
    const { result } = setup('/clients?status=active');

    act(() => {
      result.current.params.setFilter('status', null);
    });

    expect(result.current.params.filters.status).toBeUndefined();
    expect(result.current.location.search).not.toContain('status');
  });

  it('toggles a sort field between ascending and descending', () => {
    const { result } = setup('/clients');

    act(() => {
      result.current.params.toggleSort('status');
    });
    expect(result.current.params.sort).toBe('status:asc');

    act(() => {
      result.current.params.toggleSort('status');
    });
    expect(result.current.params.sort).toBe('status:desc');

    act(() => {
      result.current.params.toggleSort('displayName');
    });
    expect(result.current.params.sort).toBe('displayName:asc');
  });

  it('keeps the page in the URL only when it is past the first', () => {
    const { result } = setup('/clients');

    act(() => {
      result.current.params.setPage(3);
    });
    expect(result.current.location.search).toContain('page=3');

    act(() => {
      result.current.params.setPage(1);
    });
    expect(result.current.location.search).not.toContain('page=');
  });

  it('caps the limit at the API maximum and floors the page at one', () => {
    const { result } = setup('/clients?limit=5000&page=0');
    expect(result.current.params.limit).toBe(100);
    expect(result.current.params.page).toBe(1);
  });

  it('lists active filters with human labels and clears them all at once', () => {
    const { result } = setup('/clients?q=acme&status=active&archived=true&page=2');

    expect(result.current.params.activeFilters).toEqual([
      { key: 'q', label: 'Search', value: 'acme' },
      { key: 'status', label: 'Status', value: 'Active' },
      { key: 'archived', label: 'Archived', value: 'true' },
    ]);

    act(() => {
      result.current.params.clearFilters();
    });

    expect(result.current.params.activeFilters).toEqual([]);
    expect(result.current.params.hasFilters).toBe(false);
  });

  it('builds the API query from the URL, including page and limit', () => {
    const { result } = setup('/clients?q=acme&status=active&page=2&limit=50');
    expect(result.current.params.query).toEqual({
      page: 2,
      limit: 50,
      sort: 'displayName:asc',
      q: 'acme',
      status: 'active',
    });
  });

  it('trims a blank search rather than sending an empty parameter', () => {
    const { result } = setup('/clients?q=acme');

    act(() => {
      result.current.params.setSearch('   ');
    });

    expect(result.current.params.search).toBe('');
    expect(result.current.params.query.q).toBeUndefined();
  });
});
