import { apiGet, apiPatch, apiPost } from './client';

export interface AiToolBadge {
  tool: string;
  label: string;
}

export interface AiAction {
  label: string;
  route: string;
}

export interface AiChatReply {
  content: string;
  toolCalls: AiToolBadge[];
  actions: AiAction[];
  mode: 'llm' | 'fallback';
}

export interface AiChatRequest {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  currentRoute?: string | null;
}

export const sendAiChat = (body: AiChatRequest): Promise<AiChatReply> =>
  apiPost<AiChatReply>('/ai/chat', body);

export type AiProviderName = 'gemini' | 'openai';

export interface AiConfig {
  provider: AiProviderName | null;
  enabled: boolean;
  activeModel: string | null;
  gemini: { keySet: boolean; model: string };
  openai: { keySet: boolean; model: string };
  hasKey: boolean;
  source: 'db' | 'env' | 'none';
  configuredAt: string | null;
}

export interface AiConfigUpdate {
  provider?: AiProviderName | null;
  enabled?: boolean;
  geminiApiKey?: string | null;
  geminiModel?: string;
  openaiApiKey?: string | null;
  openaiModel?: string;
}

export const fetchAiConfig = (): Promise<AiConfig> => apiGet<AiConfig>('/ai/config');

export const updateAiConfig = (body: AiConfigUpdate): Promise<AiConfig> =>
  apiPatch<AiConfig>('/ai/config', body);
