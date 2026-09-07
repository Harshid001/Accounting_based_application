import { env } from '../config/env.js';
import { cache, createCacheKey } from '../lib/cache.js';
import type { EncryptedField } from '../lib/crypto.js';
import { decryptField, encryptField } from '../lib/crypto.js';
import { conflict } from '../lib/errors.js';
import type { AddressAttributes } from '../models/client.model.js';
import type {
  AiConfigAttributes,
  AiProviderName,
  FirmSettingsAttributes,
} from '../models/firmSettings.model.js';
import {
  DEFAULT_AI_MODELS,
  DEFAULT_CUSTOM_AI_BASE_URL,
  FIRM_SETTINGS_ID,
  FirmSettings,
} from '../models/firmSettings.model.js';
import type { RequestActor } from '../types/context.js';
import { buildDiff, recordAudit } from './audit.service.js';

export const cleanBaseUrl = (raw?: string | null): string => {
  if (!raw || raw.trim().length === 0) return DEFAULT_CUSTOM_AI_BASE_URL;
  let url = raw.trim();
  url = url.replace(/\/chat\/completions\/?$/i, '');
  url = url.replace(/\/+$/, '');
  return url;
};

export const DEFAULT_AI_CONFIG: AiConfigAttributes = {
  provider: null,
  enabled: false,
  geminiApiKey: null,
  geminiModel: DEFAULT_AI_MODELS.gemini,
  openaiApiKey: null,
  openaiModel: DEFAULT_AI_MODELS.openai,
  customApiKey: null,
  customBaseUrl: DEFAULT_CUSTOM_AI_BASE_URL,
  customModel: DEFAULT_AI_MODELS.custom,
  configuredBy: null,
  configuredAt: null,
};

export const normaliseAiConfig = (
  raw?: Partial<AiConfigAttributes> | null,
): AiConfigAttributes => {
  if (!raw) return { ...DEFAULT_AI_CONFIG };
  return {
    provider:
      raw.provider === 'gemini' || raw.provider === 'openai' || raw.provider === 'custom'
        ? raw.provider
        : null,
    enabled: Boolean(raw.enabled),
    geminiApiKey: raw.geminiApiKey ?? null,
    geminiModel:
      typeof raw.geminiModel === 'string' && raw.geminiModel.trim().length > 0
        ? raw.geminiModel.trim()
        : DEFAULT_AI_MODELS.gemini,
    openaiApiKey: raw.openaiApiKey ?? null,
    openaiModel:
      typeof raw.openaiModel === 'string' && raw.openaiModel.trim().length > 0
        ? raw.openaiModel.trim()
        : DEFAULT_AI_MODELS.openai,
    customApiKey: raw.customApiKey ?? null,
    customBaseUrl:
      typeof raw.customBaseUrl === 'string' && raw.customBaseUrl.trim().length > 0
        ? cleanBaseUrl(raw.customBaseUrl)
        : DEFAULT_CUSTOM_AI_BASE_URL,
    customModel:
      typeof raw.customModel === 'string' && raw.customModel.trim().length > 0
        ? raw.customModel.trim()
        : DEFAULT_AI_MODELS.custom,
    configuredBy: raw.configuredBy ?? null,
    configuredAt: raw.configuredAt ? new Date(raw.configuredAt) : null,
  };
};

export interface FirmSettingsUpdate {
  firmName?: string;
  address?: AddressAttributes | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  logoStorageKey?: string | null;
  defaultReminderOffsetsDays?: number[];
  complianceHorizonDays?: number;
}

export const getFirmSettings = async (): Promise<FirmSettingsAttributes> => {
  const cacheKey = createCacheKey('settings');
  const cached = cache.get<FirmSettingsAttributes>(cacheKey);
  if (cached) return cached;

  const existing = await FirmSettings.findById(FIRM_SETTINGS_ID).lean().exec();
  if (existing) {
    const normalised: FirmSettingsAttributes = {
      ...existing,
      aiConfig: normaliseAiConfig(existing.aiConfig),
    };
    if (!existing.aiConfig) {
      void FirmSettings.updateOne(
        { _id: FIRM_SETTINGS_ID, aiConfig: { $exists: false } },
        { $set: { aiConfig: DEFAULT_AI_CONFIG } },
      ).exec().catch(() => {});
    }
    cache.set(cacheKey, normalised, 60);
    return normalised;
  }
  const created = await FirmSettings.create({
    _id: FIRM_SETTINGS_ID,
    firmName: 'JV Tax Consultancy',
    contactEmail: 'jigar.taxadvocate@gmail.com',
    contactPhone: '+919737046913',
    address: {
      line1: 'F-19 Krushnam Plaza opposite the District Court',
      line2: 'near Siddharpur Char Rasta, Sardar Ganj',
      city: 'Patan',
      state: 'Gujarat',
      pincode: '384265',
    },
    complianceHorizonDays: env.COMPLIANCE_HORIZON_DAYS,
  });
  const result = created.toObject();
  const normalised: FirmSettingsAttributes = {
    ...result,
    aiConfig: normaliseAiConfig(result.aiConfig),
  };
  cache.set(cacheKey, normalised, 60);
  return normalised;
};

export const firmName = async (): Promise<string> => (await getFirmSettings()).firmName;

export const complianceHorizonDays = async (): Promise<number> => {
  const settings = await getFirmSettings();
  return settings.complianceHorizonDays;
};

export const reminderOffsetsFallback = async (): Promise<number[]> => {
  const settings = await getFirmSettings();
  return settings.defaultReminderOffsetsDays;
};

const loadSettingsDoc = async () => {
  const existing = await FirmSettings.findById(FIRM_SETTINGS_ID).exec();
  if (existing) {
    if (!existing.aiConfig) {
      existing.set('aiConfig', { ...DEFAULT_AI_CONFIG });
    }
    return existing;
  }
  // A cached copy can outlive the underlying record (fresh database in tests,
  // manual drops). Drop the cache so getFirmSettings recreates the document.
  cache.invalidate('settings');
  await getFirmSettings();
  const recreated = await FirmSettings.findById(FIRM_SETTINGS_ID).exec();
  if (!recreated) throw new Error('Firm settings document could not be created.');
  if (!recreated.aiConfig) {
    recreated.set('aiConfig', { ...DEFAULT_AI_CONFIG });
  }
  return recreated;
};

export const updateFirmSettings = async (
  update: FirmSettingsUpdate,
  actor: RequestActor,
): Promise<FirmSettingsAttributes> => {
  const before = await getFirmSettings();
  const doc = await loadSettingsDoc();

  for (const [key, value] of Object.entries(update)) {
    if (value !== undefined) doc.set(key, value);
  }
  doc.set('updatedBy', actor.id);
  await doc.save();
  const after = doc.toObject();

  const diff = buildDiff(
    before as unknown as Record<string, unknown>,
    after as unknown as Record<string, unknown>,
  ).filter((entry) => entry.field !== 'updatedAt' && entry.field !== 'updatedBy');

  if (diff.length > 0) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'firmSettings',
      entityId: FIRM_SETTINGS_ID,
      summary: 'Firm settings updated',
      diff,
    });
  }
  cache.invalidate('settings');
  return after;
};

// ---------------------------------------------------------------------------
// AI Copilot configuration (admin-managed, keys encrypted at rest)
// ---------------------------------------------------------------------------

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

export interface AiConfigView {
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

const secretSet = (secret: EncryptedField | null | undefined): boolean =>
  secret !== null && secret !== undefined;

const decryptSecret = (secret: EncryptedField | null | undefined): string | null => {
  if (!secretSet(secret)) return null;
  try {
    return decryptField(secret as EncryptedField, env.FIELD_ENCRYPTION_KEY);
  } catch {
    return null;
  }
};

export interface ResolvedAiProvider {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  baseURL?: string;
  source: 'db' | 'env';
}

export const resolveAiProvider = async (): Promise<ResolvedAiProvider | null> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);

  // Database-stored configuration takes priority.
  if (ai.provider !== null && ai.enabled) {
    const secret =
      ai.provider === 'gemini'
        ? ai.geminiApiKey
        : ai.provider === 'openai'
          ? ai.openaiApiKey
          : ai.customApiKey;
    const key = decryptSecret(secret);
    if (key !== null) {
      return {
        provider: ai.provider,
        apiKey: key,
        model:
          ai.provider === 'gemini'
            ? ai.geminiModel
            : ai.provider === 'openai'
              ? ai.openaiModel
              : ai.customModel,
        baseURL: ai.provider === 'custom' ? cleanBaseUrl(ai.customBaseUrl) : undefined,
        source: 'db',
      };
    }
  }

  // Fall back to environment variables only if they have valid keys.
  if (
    env.GEMINI_API_KEY !== undefined &&
    env.GEMINI_API_KEY.startsWith('AIza') &&
    env.GEMINI_API_KEY.length >= 20
  ) {
    return {
      provider: 'gemini',
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? DEFAULT_AI_MODELS.gemini,
      source: 'env',
    };
  }
  if (
    env.OPENAI_API_KEY !== undefined &&
    env.OPENAI_API_KEY.startsWith('sk-') &&
    env.OPENAI_API_KEY.length >= 20
  ) {
    return {
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL ?? DEFAULT_AI_MODELS.openai,
      source: 'env',
    };
  }
  const customEnvKey = env.XTROUTER_API_KEY ?? env.CUSTOM_AI_API_KEY;
  if (customEnvKey && customEnvKey.length >= 10) {
    return {
      provider: 'custom',
      apiKey: customEnvKey,
      model: env.CUSTOM_AI_MODEL ?? DEFAULT_AI_MODELS.custom,
      baseURL: cleanBaseUrl(env.CUSTOM_AI_BASE_URL),
      source: 'env',
    };
  }
  return null;
};

export const getProviderApiKey = async (provider: AiProviderName): Promise<string | null> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);
  const secret =
    provider === 'gemini'
      ? ai.geminiApiKey
      : provider === 'openai'
        ? ai.openaiApiKey
        : ai.customApiKey;
  const key = decryptSecret(secret);
  if (key !== null) return key;

  if (
    provider === 'gemini' &&
    env.GEMINI_API_KEY !== undefined &&
    env.GEMINI_API_KEY.startsWith('AIza') &&
    env.GEMINI_API_KEY.length >= 20
  ) {
    return env.GEMINI_API_KEY;
  }
  if (
    provider === 'openai' &&
    env.OPENAI_API_KEY !== undefined &&
    env.OPENAI_API_KEY.startsWith('sk-') &&
    env.OPENAI_API_KEY.length >= 20
  ) {
    return env.OPENAI_API_KEY;
  }
  if (provider === 'custom') {
    const customKey = env.XTROUTER_API_KEY ?? env.CUSTOM_AI_API_KEY;
    if (customKey && customKey.length >= 10) {
      return customKey;
    }
  }

  return null;
};

export const getCustomBaseUrl = async (): Promise<string> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);
  return cleanBaseUrl(ai.customBaseUrl ?? env.CUSTOM_AI_BASE_URL);
};

export const getAiConfigView = async (): Promise<AiConfigView> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);
  const dbKeyFor = (provider: AiProviderName): boolean =>
    provider === 'gemini'
      ? secretSet(ai.geminiApiKey)
      : provider === 'openai'
        ? secretSet(ai.openaiApiKey)
        : secretSet(ai.customApiKey);

  const resolved = await resolveAiProvider();
  const customEnvKey = env.XTROUTER_API_KEY ?? env.CUSTOM_AI_API_KEY;
  const hasKey =
    dbKeyFor('gemini') ||
    dbKeyFor('openai') ||
    dbKeyFor('custom') ||
    env.GEMINI_API_KEY !== undefined ||
    env.OPENAI_API_KEY !== undefined ||
    customEnvKey !== undefined;

  let configuredAtIso: string | null = null;
  if (ai.configuredAt) {
    try {
      configuredAtIso =
        ai.configuredAt instanceof Date
          ? ai.configuredAt.toISOString()
          : new Date(ai.configuredAt).toISOString();
    } catch {
      configuredAtIso = null;
    }
  }

  return {
    provider: ai.provider,
    enabled: ai.enabled,
    activeModel: resolved?.model ?? null,
    gemini: { keySet: dbKeyFor('gemini'), model: ai.geminiModel },
    openai: { keySet: dbKeyFor('openai'), model: ai.openaiModel },
    custom: {
      keySet: dbKeyFor('custom'),
      model: ai.customModel,
      baseUrl: cleanBaseUrl(ai.customBaseUrl),
    },
    hasKey,
    source: resolved === null ? 'none' : resolved.source,
    configuredAt: configuredAtIso,
  };
};

const encryptSecret = (plaintext: string): EncryptedField =>
  encryptField(plaintext, env.FIELD_ENCRYPTION_KEY, env.FIELD_ENCRYPTION_KEY_VERSION);

export const updateAiConfig = async (
  update: AiConfigUpdate,
  actor: RequestActor,
): Promise<AiConfigView> => {
  const doc = await loadSettingsDoc();

  if (!doc.aiConfig) {
    doc.set('aiConfig', { ...DEFAULT_AI_CONFIG });
  }
  const ai = doc.aiConfig;
  let touched = false;

  if (update.provider !== undefined) {
    ai.provider = update.provider;
    touched = true;
  }
  if (update.enabled !== undefined) {
    ai.enabled = update.enabled;
    touched = true;
  }
  if (update.geminiApiKey !== undefined) {
    ai.geminiApiKey =
      update.geminiApiKey === null ? null : encryptSecret(update.geminiApiKey);
    touched = true;
  }
  if (update.geminiModel !== undefined && update.geminiModel.trim().length > 0) {
    ai.geminiModel = update.geminiModel.trim();
    touched = true;
  }
  if (update.openaiApiKey !== undefined) {
    ai.openaiApiKey =
      update.openaiApiKey === null ? null : encryptSecret(update.openaiApiKey);
    touched = true;
  }
  if (update.openaiModel !== undefined && update.openaiModel.trim().length > 0) {
    ai.openaiModel = update.openaiModel.trim();
    touched = true;
  }
  if (update.customApiKey !== undefined) {
    ai.customApiKey =
      update.customApiKey === null ? null : encryptSecret(update.customApiKey);
    touched = true;
  }
  if (update.customBaseUrl !== undefined && update.customBaseUrl.trim().length > 0) {
    ai.customBaseUrl = cleanBaseUrl(update.customBaseUrl);
    touched = true;
  }
  if (update.customModel !== undefined && update.customModel.trim().length > 0) {
    ai.customModel = update.customModel.trim();
    touched = true;
  }

  // Enabling requires a usable key for the selected provider.
  if (ai.enabled) {
    if (ai.provider === null) {
      throw conflict('Choose Gemini, OpenAI, or Custom as the provider before enabling the copilot.');
    }
    const hasDbKey =
      ai.provider === 'gemini'
        ? secretSet(ai.geminiApiKey)
        : ai.provider === 'openai'
          ? secretSet(ai.openaiApiKey)
          : secretSet(ai.customApiKey);
    const customEnvKey = env.XTROUTER_API_KEY ?? env.CUSTOM_AI_API_KEY;
    const hasEnvKey =
      ai.provider === 'gemini'
        ? env.GEMINI_API_KEY !== undefined
        : ai.provider === 'openai'
          ? env.OPENAI_API_KEY !== undefined
          : customEnvKey !== undefined;
    if (!hasDbKey && !hasEnvKey) {
      if (update.enabled === true) {
        throw conflict('Save an API key for the selected provider before enabling the copilot.');
      }
      ai.enabled = false;
    }
  }

  if (touched) {
    ai.configuredBy = actor.id;
    ai.configuredAt = new Date();
  }

  await doc.save();
  cache.invalidate('settings');

  if (touched) {
    await recordAudit({
      actor,
      action: 'update',
      entityKind: 'firmSettings',
      entityId: FIRM_SETTINGS_ID,
      summary: `AI copilot configuration updated (provider: ${ai.provider ?? 'none'}, enabled: ${String(ai.enabled)})`,
    });
  }

  return getAiConfigView();
};
