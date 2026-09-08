import { GoogleGenAI } from '@google/genai';
import { OpenAI } from 'openai';

import { logger } from '../config/logger.js';
import type { AiProviderName } from '../models/firmSettings.model.js';
import { getCustomBaseUrl, getProviderApiKey } from './settings.service.js';

export interface DetectedAiModel {
  id: string;
  name: string;
  description?: string;
  recommended?: boolean;
}

export interface ModelDetectionResponse {
  provider: AiProviderName;
  detected: boolean;
  models: DetectedAiModel[];
  error?: string;
}

export const CURATED_MODELS: Record<AiProviderName, DetectedAiModel[]> = {
  gemini: [
    {
      id: 'gemini-2.5-flash',
      name: 'Gemini 2.5 Flash (Recommended)',
      description: 'High-speed reasoning, 1M context, best for practice copilot',
      recommended: true,
    },
    {
      id: 'gemini-2.0-flash',
      name: 'Gemini 2.0 Flash',
      description: 'Fast, multimodal, low latency',
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast, cost-efficient, high volume',
    },
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Complex reasoning and 2M token context window',
    },
  ],
  openai: [
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o mini (Recommended)',
      description: 'Fast, lightweight, cost-efficient practice copilot',
      recommended: true,
    },
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'High-intelligence flagship multimodal model',
    },
    {
      id: 'o3-mini',
      name: 'o3-mini',
      description: 'Fast reasoning model for complex tasks',
    },
    {
      id: 'o1',
      name: 'o1',
      description: 'Advanced reasoning and deep planning',
    },
  ],
  custom: [
    {
      id: 'deepseek/deepseek-v4-pro',
      name: 'DeepSeek v4 Pro (Recommended)',
      description: 'Advanced reasoning, coding, and workflow intelligence via Xkiro/XTrouter',
      recommended: true,
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek Chat (V3)',
      description: 'High-speed general reasoning and conversational copilot',
    },
    {
      id: 'deepseek/deepseek-reasoner',
      name: 'DeepSeek Reasoner (R1)',
      description: 'Deep mathematical and statutory reasoning with reasoning trace',
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      description: 'Open-weight high performance foundation model',
    },
    {
      id: 'qwen/qwen-2.5-72b-instruct',
      name: 'Qwen 2.5 72B Instruct',
      description: 'Powerful multilingual reasoning and structured extraction',
    },
  ],
};

const sortGeminiModels = (models: DetectedAiModel[]): DetectedAiModel[] => {
  const priorityOrder = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
  ];
  return [...models].sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.id);
    const idxB = priorityOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });
};

const sortOpenAiModels = (models: DetectedAiModel[]): DetectedAiModel[] => {
  const priorityOrder = ['gpt-4o-mini', 'gpt-4o', 'o3-mini', 'o1', 'o1-mini', 'gpt-4-turbo'];
  return [...models].sort((a, b) => {
    const idxA = priorityOrder.indexOf(a.id);
    const idxB = priorityOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.id.localeCompare(b.id);
  });
};

export const detectModels = async (
  provider: AiProviderName,
  explicitApiKey?: string | null,
  explicitBaseUrl?: string | null,
): Promise<ModelDetectionResponse> => {
  const apiKey =
    explicitApiKey && explicitApiKey.trim().length > 0
      ? explicitApiKey.trim()
      : await getProviderApiKey(provider);

  if (!apiKey) {
    return {
      provider,
      detected: false,
      models: CURATED_MODELS[provider],
    };
  }

  try {
    if (provider === 'gemini') {
      const client = new GoogleGenAI({ apiKey });
      const pager = await client.models.list();
      const discovered: DetectedAiModel[] = [];

      for await (const m of pager) {
        const rawName = m.name ?? '';
        const id = rawName.replace(/^models\//, '');
        if (!id.toLowerCase().includes('gemini')) continue;
        if (id.toLowerCase().includes('embedding') || id.toLowerCase().includes('aqa'))
          continue;
        if (m.supportedActions && !m.supportedActions.includes('generateContent')) continue;

        discovered.push({
          id,
          name: m.displayName ? `${m.displayName} (${id})` : id,
          description: m.description,
          recommended: id === 'gemini-2.5-flash',
        });
      }

      if (discovered.length === 0) {
        return {
          provider,
          detected: false,
          models: CURATED_MODELS.gemini,
        };
      }

      return {
        provider,
        detected: true,
        models: sortGeminiModels(discovered),
      };
    }

    if (provider === 'custom') {
      const baseUrl = explicitBaseUrl?.trim() || (await getCustomBaseUrl());
      const client = new OpenAI({ apiKey, baseURL: baseUrl });
      const res = await client.models.list();
      const discovered: DetectedAiModel[] = [];

      for (const m of res.data) {
        const id = m.id;
        discovered.push({
          id,
          name: id,
          recommended: id === 'deepseek/deepseek-v4-pro' || id.includes('deepseek-v4'),
        });
      }

      if (discovered.length === 0) {
        return {
          provider,
          detected: false,
          models: CURATED_MODELS.custom,
        };
      }

      return {
        provider,
        detected: true,
        models: discovered,
      };
    }

    // OpenAI provider
    const client = new OpenAI({ apiKey });
    const res = await client.models.list();
    const discovered: DetectedAiModel[] = [];

    for (const m of res.data) {
      const id = m.id;
      if (
        !id.startsWith('gpt-') &&
        !id.startsWith('o1') &&
        !id.startsWith('o3') &&
        !id.startsWith('chatgpt')
      ) {
        continue;
      }
      if (
        id.includes('realtime') ||
        id.includes('audio') ||
        id.includes('transcribe') ||
        id.includes('moderation') ||
        id.includes('embedding')
      ) {
        continue;
      }

      discovered.push({
        id,
        name: id,
        recommended: id === 'gpt-4o-mini',
      });
    }

    if (discovered.length === 0) {
      return {
        provider,
        detected: false,
        models: CURATED_MODELS.openai,
      };
    }

    return {
      provider,
      detected: true,
      models: sortOpenAiModels(discovered),
    };
  } catch (error) {
    logger.warn(
      { event: 'ai.detect_models_failed', provider, err: error },
      'Failed to fetch live model list from provider API',
    );
    const message =
      error instanceof Error ? error.message : 'Failed to query provider models API';
    return {
      provider,
      detected: false,
      models: CURATED_MODELS[provider],
      error: message,
    };
  }
};
