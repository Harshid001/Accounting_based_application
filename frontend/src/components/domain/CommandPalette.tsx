import { useQuery } from '@tanstack/react-query';
import * as RadixDialog from '@radix-ui/react-dialog';
import {
  ArrowRightLeft,
  Bell,
  Bot,
  Building2,
  CalendarClock,
  CheckSquare,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  ListTodo,
  MessagesSquare,
  PieChart,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAiChat, type AttachedImageData } from '@/context/AiChatContext';

import { runSearch } from '@/api/search.api';
import { queryKeys } from '@/api/queryKeys';
import { cn } from '@/lib/cn';
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants';
import { useDebounce } from '@/hooks/useDebounce';
import { useReturnFocus } from '@/hooks/useReturnFocus';
import { Spinner } from '@/components/ui/skeleton';
import { useFeatureGuide } from '@/context/FeatureGuideContext';
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
  initialImage?: AttachedImageData | null;
  onClearInitialImage?: () => void;
}

interface QuickItem {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  icon: ReactNode;
  onSelect: () => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  initialImage,
  onClearInitialImage,
}: CommandPaletteProps) {
  const navigate = useNavigate();
  const { openGuide } = useFeatureGuide();
  const { openWithPrompt } = useAiChat();
  const [term, setTerm] = useState('');
  const [attachedImage, setAttachedImage] = useState<AttachedImageData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const debounced = useDebounce(term, SEARCH_DEBOUNCE_MS);
  const { onCloseAutoFocus } = useReturnFocus(open);
  const isQueryMode = debounced.trim().length >= 2;

  useEffect(() => {
    if (initialImage) {
      setAttachedImage(initialImage);
      onClearInitialImage?.();
    }
  }, [initialImage, onClearInitialImage]);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAttachedImage({
          dataUrl: reader.result,
          name: file.name || 'Pasted image',
          mimeType: file.type,
        });
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(file);
            break;
          }
        }
      }
    },
    [handleImageFile],
  );

  const close = useCallback(
    (next: boolean): void => {
      if (!next) {
        setTerm('');
        setAttachedImage(null);
        setActive(0);
      }
      onOpenChange(next);
    },
    [onOpenChange],
  );

  const quickItems = useMemo<QuickItem[]>(() => {
    const items: QuickItem[] = [];

    if (attachedImage) {
      items.push(
        {
          id: 'act-ai-image',
          title: 'Analyze Document with FirmDesk AI Copilot',
          subtitle: 'Inspect this image, extract PAN/GSTIN/invoice details & automate actions',
          group: 'Visual Search & AI',
          icon: <Bot size={14} className="text-indigo-500" />,
          onSelect: () => {
            close(false);
            openWithPrompt(
              term.trim() ||
                'Please analyze this attached document or invoice and identify the client, filing details, amounts, tax identifiers, or relevant action items.',
              attachedImage,
            );
          },
        },
        {
          id: 'act-search-docs-image',
          title: 'Search Document Repository',
          subtitle: 'Find and match stored records in firm client documents',
          group: 'Visual Search & AI',
          icon: <FileText size={14} className="text-emerald-500" />,
          onSelect: () => {
            close(false);
            void navigate('/documents');
          },
        },
      );
    }

    items.push(
      {
        id: 'act-guide',
        title: 'Feature Guide & Interactive Tour',
        subtitle: 'Learn this screen & view live tutorial',
        group: 'Quick Actions',
        icon: <Sparkles size={14} className="text-amber-400" />,
        onSelect: () => {
          close(false);
          openGuide();
        },
      },
      {
        id: 'act-add-client',
        title: 'Add New Client',
        subtitle: 'Onboard an individual, company or partnership',
        group: 'Quick Actions',
        icon: <Plus size={14} className="text-[var(--fd-accent)]" />,
        onSelect: () => {
          close(false);
          void navigate('/clients/new');
        },
      },
      {
        id: 'act-gen-filings',
        title: 'Generate Statutory Filings',
        subtitle: 'Bulk generate upcoming GST, TDS or IT returns',
        group: 'Quick Actions',
        icon: <CalendarClock size={14} className="text-emerald-500" />,
        onSelect: () => {
          close(false);
          void navigate('/compliance/generate');
        },
      },
      {
        id: 'nav-dashboard',
        title: 'Executive Dashboard',
        subtitle: 'Practice overview, deadline buckets, workload',
        group: 'Quick Jump',
        icon: <LayoutDashboard size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/dashboard');
        },
      },
      {
        id: 'nav-mywork',
        title: 'My Work Queue',
        subtitle: 'Your personal filings and tasks list',
        group: 'Quick Jump',
        icon: <ListTodo size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/my-work');
        },
      },
      {
        id: 'nav-clients',
        title: 'Client Management',
        subtitle: 'Client directory, KYC profiles and services',
        group: 'Quick Jump',
        icon: <Building2 size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/clients');
        },
      },
      {
        id: 'nav-compliance',
        title: 'Statutory Filings',
        subtitle: 'GST, TDS, Income Tax compliance tracker',
        group: 'Quick Jump',
        icon: <CalendarClock size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/compliance');
        },
      },
      {
        id: 'nav-tasks',
        title: 'Tasks & Workflow',
        subtitle: 'Firm tasks, checklist items and assignments',
        group: 'Quick Jump',
        icon: <CheckSquare size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/tasks');
        },
      },
      {
        id: 'nav-documents',
        title: 'Document Vault',
        subtitle: 'Client files, tax returns, bills and KYC records',
        group: 'Quick Jump',
        icon: <FileText size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/documents');
        },
      },
      {
        id: 'nav-converter',
        title: 'File Converter & Modifier',
        subtitle: 'Convert PDF to Word, PNG to JPG, Word to PDF & modify images',
        group: 'Quick Jump',
        icon: <ArrowRightLeft size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/converter');
        },
      },
      {
        id: 'nav-requests',
        title: 'Client Document Requests',
        subtitle: 'Pending document uploads requested from clients',
        group: 'Quick Jump',
        icon: <Inbox size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/requests');
        },
      },
      {
        id: 'nav-messages',
        title: 'Client Communications',
        subtitle: 'Two-way message threads with client portal users',
        group: 'Quick Jump',
        icon: <MessagesSquare size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/messages');
        },
      },
      {
        id: 'nav-reports',
        title: 'Audit & MIS Reports',
        subtitle: 'Compliance tracking, roster and workload reports',
        group: 'Quick Jump',
        icon: <PieChart size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/reports/compliance');
        },
      },
      {
        id: 'nav-notifications',
        title: 'Notifications & Alerts',
        subtitle: 'Deadlines, assignment updates and client messages',
        group: 'Quick Jump',
        icon: <Bell size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/notifications');
        },
      },
      {
        id: 'nav-settings',
        title: 'Firm Settings & Catalogue',
        subtitle: 'Firm profile, users, compliance catalogue and audit logs',
        group: 'Quick Jump',
        icon: <Settings size={14} />,
        onSelect: () => {
          close(false);
          void navigate('/settings/firm');
        },
      },
    );

    if (!term.trim()) return items;
    const lower = term.toLowerCase().trim();
    return items.filter(
      (item) => item.title.toLowerCase().includes(lower) || item.subtitle.toLowerCase().includes(lower),
    );
  }, [attachedImage, term, openGuide, navigate, close, openWithPrompt]);

  const query = useQuery({
    queryKey: queryKeys.search(debounced.trim()),
    queryFn: ({ signal }) => runSearch(debounced.trim(), signal),
    enabled: isQueryMode,
    staleTime: 30_000,
  });

  const flattened = useMemo(() => {
    if (!isQueryMode) {
      return quickItems.map((item) => ({
        type: 'quick' as const,
        group: item.group,
        item,
      }));
    }

    const results = query.data;
    const serverHits: Array<{ type: 'search'; group: string; hit: SearchHit }> = [];
    if (results !== undefined) {
      GROUPS.forEach((group) => {
        results[group.key].forEach((hit) => {
          serverHits.push({ type: 'search', group: group.label, hit });
        });
      });
    }

    const matchingQuick: Array<{ type: 'quick'; group: string; item: QuickItem }> = quickItems.map(
      (item) => ({
        type: 'quick',
        group: item.group,
        item,
      }),
    );

    return [...matchingQuick, ...serverHits];
  }, [isQueryMode, quickItems, query.data]);

  const activeIndex = flattened.length === 0 ? 0 : Math.min(active, flattened.length - 1);

  const go = (entry: (typeof flattened)[number]): void => {
    if (entry.type === 'quick') {
      entry.item.onSelect();
    } else {
      close(false);
      void navigate(entry.hit.link);
    }
  };

  return (
    <RadixDialog.Root open={open} onOpenChange={close}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-[var(--fd-overlay)] backdrop-blur-xs" />
        <RadixDialog.Content
          data-slot="command-palette"
          onCloseAutoFocus={onCloseAutoFocus}
          onPaste={handlePaste}
          className="fixed top-[10vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] shadow-2xl"
        >
          <RadixDialog.Title className="sr-only">Search FirmDesk</RadixDialog.Title>
          <RadixDialog.Description className="sr-only">
            Search clients, filings, tasks, documents and quick actions.
          </RadixDialog.Description>

          <div className="flex items-center gap-2 border-b border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/50 px-3.5">
            <Search size={16} aria-hidden="true" className="text-[var(--fd-accent)]" />
            <input
              type="text"
              value={term}
              onPaste={handlePaste}
              aria-label="Search features, clients, filings, tasks and documents"
              placeholder={
                attachedImage
                  ? 'Type search filter or select AI analysis below...'
                  : 'Search features, clients, filings, tasks, or paste an image (Ctrl+V)...'
              }
              className="h-12 w-full bg-transparent text-sm font-medium text-[var(--fd-text-primary)] outline-none placeholder:text-[var(--fd-text-tertiary)]"
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
                  if (entry !== undefined) go(entry);
                }
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach or paste an image (Ctrl+V)"
              aria-label="Attach image"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--fd-text-tertiary)] hover:bg-[var(--fd-surface-3)] hover:text-indigo-500 cursor-pointer transition-colors"
            >
              <ImageIcon size={15} />
            </button>
            {query.isFetching ? <Spinner size={14} label="Searching" /> : null}
          </div>

          {/* Attached Image Banner in Command Palette */}
          {attachedImage && (
            <div className="flex items-center justify-between border-b border-[var(--fd-border-subtle)] bg-indigo-500/10 px-3.5 py-2 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={attachedImage.dataUrl}
                  alt={attachedImage.name || 'Pasted image'}
                  className="h-9 w-9 rounded-md object-cover border border-indigo-500/30 shrink-0"
                />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[var(--fd-text-primary)] flex items-center gap-1.5">
                    <span>📷 {attachedImage.name || 'Pasted Image'}</span>
                    <span className="rounded bg-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                      Visual Input
                    </span>
                  </div>
                  <div className="text-[11px] text-[var(--fd-text-secondary)] truncate">
                    Ready to analyze with FirmDesk AI Copilot
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    close(false);
                    openWithPrompt(
                      term.trim() ||
                        'Please analyze this attached document or invoice and identify the client, filing details, amounts, tax identifiers, or relevant action items.',
                      attachedImage,
                    );
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-indigo-700 cursor-pointer"
                >
                  <Bot size={12} />
                  <span>Analyze with AI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAttachedImage(null)}
                  title="Remove image"
                  aria-label="Remove image"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--fd-text-tertiary)] hover:bg-[var(--fd-surface-3)] hover:text-[var(--fd-text-primary)] cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-3">
            {isQueryMode && query.isError ? (
              <p className="px-2 py-6 text-center text-xs text-[var(--fd-status-danger)]">
                Search is unavailable right now. Try again in a moment.
              </p>
            ) : flattened.length === 0 && !query.isFetching ? (
              <p className="px-2 py-8 text-center text-xs text-[var(--fd-text-tertiary)]">
                Nothing matches “{term.trim()}”.
              </p>
            ) : (
              // Group items by group name
              Array.from(new Set(flattened.map((f) => f.group))).map((groupName) => {
                const groupEntries = flattened.filter((f) => f.group === groupName);
                if (groupEntries.length === 0) return null;

                return (
                  <div key={groupName} className="space-y-1">
                    <p className="px-2 py-1 text-[11px] font-bold tracking-wider text-[var(--fd-text-tertiary)] uppercase">
                      {groupName}
                    </p>
                    <ul className="space-y-0.5">
                      {groupEntries.map((entry) => {
                        const globalIndex = flattened.indexOf(entry);
                        const isSelected = globalIndex === activeIndex;

                        if (entry.type === 'quick') {
                          return (
                            <li key={entry.item.id}>
                              <button
                                type="button"
                                onMouseEnter={() => setActive(globalIndex)}
                                onClick={() => go(entry)}
                                className={cn(
                                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
                                  isSelected
                                    ? 'bg-[var(--fd-surface-3)] text-[var(--fd-text-primary)]'
                                    : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)]',
                                )}
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)]">
                                  {entry.item.icon}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs font-semibold text-[var(--fd-text-primary)]">
                                    {entry.item.title}
                                  </span>
                                  <span className="block truncate text-[11px] text-[var(--fd-text-tertiary)]">
                                    {entry.item.subtitle}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        }

                        return (
                          <li key={`${entry.hit.kind}-${entry.hit.id}`}>
                            <button
                              type="button"
                              onMouseEnter={() => setActive(globalIndex)}
                              onClick={() => go(entry)}
                              className={cn(
                                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors cursor-pointer',
                                isSelected
                                  ? 'bg-[var(--fd-surface-3)] text-[var(--fd-text-primary)]'
                                  : 'text-[var(--fd-text-secondary)] hover:bg-[var(--fd-surface-2)] hover:text-[var(--fd-text-primary)]',
                              )}
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--fd-surface-2)] text-[var(--fd-text-secondary)]">
                                {ICONS[entry.hit.kind]}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-xs font-semibold text-[var(--fd-text-primary)]">
                                  {entry.hit.title}
                                </span>
                                {entry.hit.subtitle && (
                                  <span className="block truncate text-[11px] text-[var(--fd-text-tertiary)]">
                                    {entry.hit.subtitle}
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

          {/* Footer Shortcuts Hint Bar */}
          <div className="flex items-center justify-between border-t border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]/60 px-3.5 py-2 text-[11px] text-[var(--fd-text-tertiary)]">
            <div className="flex items-center gap-3">
              <span>
                <kbd className="rounded border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-1.5 py-0.5 text-[10px] font-medium">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="rounded border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-1.5 py-0.5 text-[10px] font-medium">↵</kbd> select
              </span>
              <span>
                <kbd className="rounded border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-1.5 py-0.5 text-[10px] font-medium">Esc</kbd> close
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <HelpCircle className="h-3 w-3 text-[var(--fd-accent)]" />
              <span>Press <kbd className="rounded border border-[var(--fd-border)] bg-[var(--fd-surface-1)] px-1 py-0.5 text-[10px] font-medium">?</kbd> for tour</span>
            </div>
          </div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
