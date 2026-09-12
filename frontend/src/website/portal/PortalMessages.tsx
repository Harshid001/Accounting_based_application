import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Clock,
  FileQuestion,
  HelpCircle,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';


import { listMessages, postMessage } from '@/api/messages.api';
import { queryKeys } from '@/api/queryKeys';
import { Card } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/error-state';
import { PageHeader } from '@/components/ui/page-header';
import { Pagination } from '@/components/ui/pagination';
import { MessageComposer } from '@/components/domain/MessageComposer';
import { MessageThread } from '@/components/domain/MessageThread';
import { useActiveClient } from '@/context/ActiveClientContext';
import { useToast } from '@/context/ToastContext';
import { useListParams } from '@/hooks/useListParams';
import { usePageTitle } from '@/hooks/usePageTitle';

const INQUIRY_PRESETS = [
  {
    icon: Receipt,
    label: 'GST Return Status',
    text: 'Hello, please confirm if our latest GST return (GSTR-1 / 3B) is ready or if any purchase bills are missing.',
  },
  {
    icon: ShieldCheck,
    label: 'ITR / Advance Tax',
    text: 'Could you please check our advance tax liability for the current quarter and advise payment details?',
  },
  {
    icon: FileQuestion,
    label: 'Document Clarification',
    text: 'We have uploaded our recent bank statements and bills. Please review and let us know if anything else is needed.',
  },
  {
    icon: HelpCircle,
    label: 'General Inquiry',
    text: 'I have a query regarding tax deduction / compliance for our upcoming transaction. Could we discuss this?',
  },
];

export function PortalMessages() {
  usePageTitle('Messages — Client Communication');
  const { activeClientId, activeClient } = useActiveClient();
  const clientId = activeClientId ?? '';
  const queryClient = useQueryClient();
  const { errorToast, success } = useToast();

  const params = useListParams({ filterKeys: [], defaultLimit: 25 });
  const pageQuery = { page: params.page, limit: params.limit };

  const query = useQuery({
    queryKey: queryKeys.clients.messages(clientId, pageQuery),
    queryFn: () => listMessages(clientId, pageQuery),
    enabled: clientId.length > 0,
    staleTime: 15_000,
  });

  const send = useMutation({
    mutationFn: (body: string) => postMessage(clientId, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.messages(clientId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications.unread });
      success('Message sent', 'Your firm has been notified.');
    },
    onError: (error: unknown) => {
      errorToast(error, 'That message was not sent');
    },
  });

  const remove = useMutation({
    mutationFn: (messageId: string) => {
      return import('@/api/messages.api').then(({ deleteMessage }) => deleteMessage(clientId, messageId));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.clients.messages(clientId) });
    },
    onError: (error: unknown) => {
      errorToast(error, 'That message could not be deleted');
    },
  });


  const sendPreset = async (text: string) => {
    await send.mutateAsync(text).catch(() => undefined);
  };

  return (
    <>
      <PageHeader
        title="Direct Communication with Your Firm"
        description={
          activeClient === null
            ? 'Dedicated channel for direct questions, tax advisory, and compliance updates.'
            : `Dedicated channel with Chartered Accountants & team regarding ${activeClient.displayName}.`
        }
      />

      {/* Firm Support & Availability Banner */}
      <div className="mb-4 rounded-xl border border-[var(--fd-border)] bg-[var(--fd-surface-1)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--fd-accent)]/10 text-[var(--fd-accent)]">
              <Briefcase size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-[var(--fd-text-primary)]">
                  FirmDesk Practice Team
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fd-status-done-bg)] px-2 py-0.5 text-3xs font-semibold text-[var(--fd-status-done)] uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--fd-status-done)] animate-pulse" />
                  Active
                </span>
              </div>
              <p className="text-xs text-[var(--fd-text-secondary)]">
                Assigned Accountants & Admin monitor this thread. Messages are archived for compliance history.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[var(--fd-text-tertiary)]">
            <Clock size={14} />
            <span>Mon–Sat: 10:00 AM – 7:00 PM IST</span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Quick Consultation Presets */}
        <div className="rounded-xl border border-[var(--fd-border-subtle)] bg-[var(--fd-surface-1)] p-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--fd-text-secondary)] mb-2.5">
            <Sparkles size={14} className="text-[var(--fd-accent)]" />
            <span>Quick Inquiries & Prompts</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {INQUIRY_PRESETS.map((preset, idx) => {
              const Icon = preset.icon;
              return (
                <button
                  type="button"
                  key={idx}
                  disabled={send.isPending}
                  onClick={() => sendPreset(preset.text)}
                  className="flex items-center gap-2.5 rounded-lg border border-[var(--fd-border)] bg-[var(--fd-surface-2)] p-2.5 text-left transition-all hover:border-[var(--fd-accent)] hover:bg-[var(--fd-surface-3)] group"
                >
                  <Icon size={16} className="shrink-0 text-[var(--fd-accent)] group-hover:scale-110 transition-transform" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[var(--fd-text-primary)] truncate">
                      {preset.label}
                    </div>
                    <div className="text-3xs text-[var(--fd-text-tertiary)] truncate">
                      Click to send inquiry
                    </div>
                  </div>
                  <Send size={12} className="shrink-0 opacity-0 group-hover:opacity-100 text-[var(--fd-accent)] transition-opacity" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Thread History */}
        <Card className="p-4 sm:p-5">
          {query.isError ? (
            <ErrorState
              error={query.error}
              title="Messages did not load"
              onRetry={() => {
                void query.refetch();
              }}
            />
          ) : (
            <MessageThread 
              messages={query.data?.items ?? []} 
              loading={query.isPending}
              onDelete={(messageId) => {
                if (window.confirm('Are you sure you want to delete this message?')) {
                  void remove.mutateAsync(messageId);
                }
              }} 
            />
          )}

          {query.data === undefined || query.data.total <= query.data.limit ? null : (
            <div className="mt-4 border-t border-[var(--fd-border-subtle)] pt-3">
              <Pagination
                page={query.data.page}
                limit={query.data.limit}
                total={query.data.total}
                totalPages={query.data.totalPages}
                onPageChange={params.setPage}
                onLimitChange={params.setLimit}
                label="messages"
              />
            </div>
          )}
        </Card>

        {/* Message Composer */}
        <Card className="p-4">
          <MessageComposer
            placeholder="Type your message, query, or document note for the accounting team... (Press Ctrl + Enter to send)"
            onSend={async (body) => {
              await send.mutateAsync(body).catch(() => undefined);
            }}
          />
        </Card>
      </div>
    </>
  );
}

