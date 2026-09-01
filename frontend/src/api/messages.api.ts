import { apiGet, apiList, apiPost } from '@/api/client';
import type { Paged, QueryParams } from '@/types/api';
import type { ContextRefKind } from '@/types/enums';
import type { MessageView, ThreadView } from '@/types/models';

export const listMessages = (
  clientId: string,
  params: QueryParams,
): Promise<Paged<MessageView>> =>
  apiList<MessageView>(`/clients/${clientId}/messages`, { method: 'GET', query: params });

export interface PostMessageInput {
  body: string;
  attachmentIds?: string[];
  contextRef?: { kind: ContextRefKind; id: string } | null;
}

export const postMessage = (clientId: string, input: PostMessageInput): Promise<MessageView> =>
  apiPost<MessageView>(`/clients/${clientId}/messages`, input);

export const listThreads = (): Promise<ThreadView[]> => apiGet<ThreadView[]>('/messages/threads');
