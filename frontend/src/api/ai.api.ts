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
  image?: { dataUrl: string; mimeType?: string } | null;
}

export const sendAiChat = (body: AiChatRequest): Promise<AiChatReply> =>
  apiPost<AiChatReply>('/ai/chat', body);

export type AiProviderName = 'gemini' | 'openai' | 'custom';

export interface AiConfig {
  provider: AiProviderName | null;
  enabled: boolean;
  activeModel: string | null;
  gemini: { keySet: boolean; model: string };
  openai: { keySet: boolean; model: string };
  custom: { keySet: boolean; model: string; baseUrl: string };
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
  customApiKey?: string | null;
  customBaseUrl?: string;
  customModel?: string;
}

export const fetchAiConfig = (): Promise<AiConfig> => apiGet<AiConfig>('/ai/config');

export const updateAiConfig = (body: AiConfigUpdate): Promise<AiConfig> =>
  apiPatch<AiConfig>('/ai/config', body);

export interface DetectedAiModel {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
}

export interface AiModelDetectionResult {
  provider: AiProviderName;
  detected: boolean;
  models: DetectedAiModel[];
  error?: string;
}

export const detectAiModels = (body: {
  provider: AiProviderName;
  apiKey?: string;
  baseUrl?: string;
}): Promise<AiModelDetectionResult> =>
  apiPost<AiModelDetectionResult>('/ai/models', body);
