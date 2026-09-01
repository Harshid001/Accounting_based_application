import { MessagesSquare, Paperclip } from 'lucide-react';
import { Link } from 'react-router-dom';

import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/date';
import { ROLE_LABELS } from '@/lib/constants';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { MessageView } from '@/types/models';

export interface MessageThreadProps {
  messages: readonly MessageView[];
  loading?: boolean;
  contextLinkFor?: (kind: string, id: string) => string | null;
}

function MessageBubble({
  message,
  contextLinkFor,
}: {
  message: MessageView;
  contextLinkFor?: (kind: string, id: string) => string | null;
}) {
  const contextLink =
    message.contextRef === null
      ? null
      : (contextLinkFor?.(message.contextRef.kind, message.contextRef.id) ?? null);

  return (
    <li className={cn('flex gap-3', message.mine && 'flex-row-reverse')}>
      <Avatar name={message.author?.name ?? 'Removed user'} size="sm" className="mt-1" />
      <div className={cn('min-w-0 max-w-[85%]', message.mine && 'text-right')}>
        <div
          className={cn(
            'flex flex-wrap items-baseline gap-2',
            message.mine && 'flex-row-reverse',
          )}
        >
          <span className="text-xs font-medium text-[var(--fd-text-primary)]">
            {message.author?.name ?? 'Removed user'}
          </span>
          <span className="text-2xs text-[var(--fd-text-tertiary)]">
            {ROLE_LABELS[message.authorRole]}
          </span>
          <time
            dateTime={message.createdAt ?? undefined}
            className="text-2xs text-[var(--fd-text-tertiary)]"
          >
            {formatDateTime(message.createdAt)}
          </time>
        </div>

        <div
          className={cn(
            'mt-1 inline-block rounded-lg border px-3 py-2 text-left',
            message.mine
              ? 'border-[var(--fd-accent)] bg-[var(--fd-accent-subtle-bg)]'
              : 'border-[var(--fd-border-subtle)] bg-[var(--fd-surface-2)]',
          )}
        >
          <p className="text-base whitespace-pre-wrap text-[var(--fd-text-primary)]">
            {message.body}
          </p>

          {message.attachments.length > 0 ? (
            <ul className="mt-2 space-y-1 border-t border-[var(--fd-border-subtle)] pt-2">
              {message.attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center gap-1.5 text-xs text-[var(--fd-text-secondary)]"
                >
                  <Paperclip size={12} aria-hidden="true" />
                  {attachment.title}
                </li>
              ))}
            </ul>
          ) : null}

          {contextLink === null ? null : (
            <Link
              to={contextLink}
              className="mt-2 inline-block rounded-sm text-xs text-[var(--fd-accent)] underline underline-offset-4"
            >
              View the linked item
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

export function MessageThread({ messages, loading = false, contextLinkFor }: MessageThreadProps) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="h-6 w-6" rounded="full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-10 w-3/4" rounded="lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare size={20} aria-hidden="true" />}
        title="No messages yet"
        description="Start the conversation below. Everyone linked to this client can read it."
      />
    );
  }

  return (
    <ul className="space-y-4">
      {[...messages].reverse().map((message) => (
        <MessageBubble key={message.id} message={message} {...(contextLinkFor ? { contextLinkFor } : {})} />
      ))}
    </ul>
  );
}
