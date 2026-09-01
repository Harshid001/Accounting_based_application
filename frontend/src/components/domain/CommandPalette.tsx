import { useQuery } from '@tanstack/react-query';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Building2, CheckSquare, FileText, Search, CalendarClock } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { runSearch } from '@/api/search.api';
import { queryKeys } from '@/api/queryKeys';
import { cn } from '@/lib/cn';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { Spinner } from '@/components/ui/skeleton';
import type { SearchHit, SearchResults } from '@/types/models';

const ICONS: Record<SearchHit['kind'], ReactNode> = {
  client: <Building2 size={14} aria-hidden="true" />,
  task: <CheckSquare size={14} aria-hidden="true" />,
  compliance: <CalendarClock size={14} aria-hidden="true" />,
  document: <FileText size={14} aria-hidden="true" />,
};

const GROUPS: Array<{ key: keyof SearchResults; label: string }> = [
  { key: 'clients', label: 'Clients' },
  { key: 'compliance', label: 'Filings' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'documents', label: 'Documents' },
];

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [active, setActive] = useState(0);
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS);
  const { onCloseAutoFocus } = useReturnFocus(open);
  const enabled = open && debounced.trim().length >= 2;

  const query = useQuery({
    queryKey: queryKeys.search(debounced.trim()),
    queryFn: ({ signal }) => runSearch(debounced.trim(), signal),
    enabled,
    staleTime: 30_000,
  });

  const flattened = useMemo(() => {
    const results = query.data;
    if (results === undefined) return [] as Array<{ group: string; hit: SearchHit }>;
    return GROUPS.flatMap((group) =>
      results[group.key].map((hit) => ({ group: group.label, hit })),
    );
  }, [query.data]);

  const activeIndex = flattened.length === 0 ? 0 : Math.min(active, flattened.length - 1);

  const close = (next: boolean): void => {
    if (!next) {
      setTerm('');
      setActive(0);
    }
    onOpenChange(next);
  };

  const go = (hit: SearchHit): void => {
    close(false);
    void navigate(hit.link);
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={close}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--fd-overlay)]" />
        <RadixDialog.Content
          data-slot="command-palette"
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-[12vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-[var(--fd-shadow-overlay)]"
        >
          <RadixDialog.Title className="sr-only">Search FirmDesk</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Search clients, filings, tasks and documents you have access to.
          </RadixDialog.Description>

          <div className="flex items-center gap-2 border-b border-[var(--fd-border-subtle)] px-3">
            <Search size={16} aria-hidden="true" className="text-[var(--fd-text-tertiary)]" />
            <input
              type="text"
              value={term}
              aria-label="Search clients, filings, tasks and documents"
              placeholder="Search clients, filings, tasks and documents"
              className="h-12 w-full bg-transparent text-md text-[var(--fd-text-primary)] outline-none placeholder:text-[var(--fd-text-tertiary)]"
              onChange={(event) => {
                setTerm(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  setActive((index) => Math.min(index + 1, flattened.length - 1));
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((index) => Math.max(index - 1, 0));
                } else if (event.key === 'Enter') {
                  event.preventDefault();
                  const entry = flattened[activeIndex];
                  if (entry !== undefined) go(entry.hit);
                }
              }}
            />
            {query.isFetching ? <Spinner size={14} label="Searching" /> : null}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {term.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-xs text-[var(--fd-text-tertiary)]">
                Type at least two characters. Results stay inside what you are allowed to see.
              </p>
            ) : query.isError ? (
              <p className="px-2 py-6 text-center text-xs text-[var(--fd-status-danger)]">
                Search is unavailable right now. Try again in a moment.
              </p>
            ) : flattened.length === 0 && !query.isFetching ? (
              <p className="px-2 py-6 text-center text-xs text-[var(--fd-text-tertiary)]">
                Nothing matches “{term.trim()}”.
              </p>
            ) : (
              GROUPS.map((group) => {
                const hits = query.data?.[group.key] ?? [];
                if (hits.length === 0) return null;
                return (
                  <div key={group.key} className="mb-2 last:mb-0">
                    <p className="text-2xs px-2 py-1 tracking-wide text-[var(--fd-text-tertiary)] uppercase">
                      {group.label}
                    </p>
                    <ul>
                      {hits.map((hit) => {
                        const index = flattened.findIndex(
                          (entry) => entry.hit.kind === hit.kind && entry.hit.id === hit.id,
                        );
                        return (
                          <li key={`${hit.kind}-${hit.id}`}>
                            <button
                              type="button"
                              onMouseEnter={() => {
                                setActive(index);
                              }}
                              onClick={() => {
                                go(hit);
                              }}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left',
                                index === activeIndex
                                  ? 'bg-[var(--fd-surface-3)]'
                                  : 'hover:bg-[var(--fd-surface-2)]',
                              )}
                            >
                              <span className="shrink-0 text-[var(--fd-text-tertiary)]">
                                {ICONS[hit.kind]}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-base text-[var(--fd-text-primary)]">
                                  {hit.title}
                                </span>
                                {hit.subtitle === null ? null : (
                                  <span className="text-2xs block truncate text-[var(--fd-text-tertiary)]">
                                    {hit.subtitle}
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
