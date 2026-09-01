import type { MessageAttributes } from '../models/message.model.js';
import type { ThreadSummary } from '../services/message.service.js';
import type { Lean } from '../types/lean.js';
import { idOf, personRef, textOf, timestamp } from './common.js';
import type { PersonRef } from './common.js';

type MessageRecord = Lean<MessageAttributes>;

export interface MessageAttachmentView {
  id: string;
  title: string;
  documentType: string;
}

export interface MessageView {
  id: string;
  body: string;
  author: PersonRef | null;
  authorRole: string;
  attachments: MessageAttachmentView[];
  contextRef: { kind: string; id: string } | null;
  createdAt: string | null;
  mine: boolean;
}

const attachmentView = (value: unknown): MessageAttachmentView | null => {
  const id = idOf(value);
  if (id === null) return null;
  return {
    id,
    title: textOf(value, 'title') ?? 'Document',
    documentType: textOf(value, 'documentType') ?? 'other',
  };
};

export const serialiseMessage = (
  message: MessageRecord,
  viewerId: string,
): MessageView => ({
  id: message._id.toString(),
  body: message.body,
  author: personRef(message.author),
  authorRole: message.authorRole,
  attachments: message.attachments
    .map((value) => attachmentView(value))
    .filter((value): value is MessageAttachmentView => value !== null),
  contextRef: message.contextRef
    ? { kind: message.contextRef.kind, id: message.contextRef.id.toString() }
    : null,
  createdAt: timestamp(message.createdAt),
  mine: idOf(message.author) === viewerId,
});

export interface ThreadView {
  clientId: string;
  clientName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

export const serialiseThread = (thread: ThreadSummary): ThreadView => ({
  clientId: thread.clientId,
  clientName: thread.clientName,
  lastMessageAt: timestamp(thread.lastMessageAt),
  lastMessagePreview: thread.lastMessagePreview,
  unreadCount: thread.unreadCount,
});
