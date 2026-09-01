import { apiGet } from '@/api/client';
import type { SearchResults } from '@/types/models';

export const runSearch = (term: string, signal?: AbortSignal): Promise<SearchResults> =>
  apiGet<SearchResults>('/search', { q: term }, signal);
