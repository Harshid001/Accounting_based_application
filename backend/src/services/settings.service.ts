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
  FIRM_SETTINGS_ID,
  FirmSettings,
} from '../models/firmSettings.model.js';
import type { RequestActor } from '../types/context.js';
import { buildDiff, recordAudit } from './audit.service.js';

export const DEFAULT_AI_CONFIG: AiConfigAttributes = {
  provider: null,
  enabled: false,
  geminiApiKey: null,
  geminiModel: DEFAULT_AI_MODELS.gemini,
  openaiApiKey: null,
  openaiModel: DEFAULT_AI_MODELS.openai,
  configuredBy: null,
  configuredAt: null,
};

export const normaliseAiConfig = (
  raw?: Partial<AiConfigAttributes> | null,
): AiConfigAttributes => {
  if (!raw) return { ...DEFAULT_AI_CONFIG };
  return {
    provider: raw.provider === 'gemini' || raw.provider === 'openai' ? raw.provider : null,
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
}

export interface AiConfigView {
  provider: AiProviderName | null;
  enabled: boolean;
  activeModel: string | null;
  gemini: { keySet: boolean; model: string };
  openai: { keySet: boolean; model: string };
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
  source: 'db' | 'env';
}

export const resolveAiProvider = async (): Promise<ResolvedAiProvider | null> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);

  // Database-stored configuration takes priority.
  if (ai.provider !== null && ai.enabled) {
    const secret =
      ai.provider === 'gemini' ? ai.geminiApiKey : ai.openaiApiKey;
    const key = decryptSecret(secret);
    if (key !== null) {
      return {
        provider: ai.provider,
        apiKey: key,
        model:
          ai.provider === 'gemini'
            ? ai.geminiModel
            : ai.openaiModel,
        source: 'db',
      };
    }
  }

  // Fall back to environment variables.
  if (env.GEMINI_API_KEY !== undefined) {
    return {
      provider: 'gemini',
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL ?? DEFAULT_AI_MODELS.gemini,
      source: 'env',
    };
  }
  if (env.OPENAI_API_KEY !== undefined) {
    return {
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL ?? DEFAULT_AI_MODELS.openai,
      source: 'env',
    };
  }
  return null;
};

export const getAiConfigView = async (): Promise<AiConfigView> => {
  const settings = await getFirmSettings();
  const ai = normaliseAiConfig(settings.aiConfig);
  const dbKeyFor = (provider: AiProviderName): boolean =>
    provider === 'gemini' ? secretSet(ai.geminiApiKey) : secretSet(ai.openaiApiKey);

  const resolved = await resolveAiProvider();
  const hasKey =
    dbKeyFor('gemini') ||
    dbKeyFor('openai') ||
    env.GEMINI_API_KEY !== undefined ||
    env.OPENAI_API_KEY !== undefined;

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

  // Enabling requires a usable key for the selected provider.
  if (ai.enabled) {
    if (ai.provider === null) {
      throw conflict('Choose Gemini or OpenAI as the provider before enabling the copilot.');
    }
    const hasDbKey = ai.provider === 'gemini' ? secretSet(ai.geminiApiKey) : secretSet(ai.openaiApiKey);
    const hasEnvKey =
      ai.provider === 'gemini' ? env.GEMINI_API_KEY !== undefined : env.OPENAI_API_KEY !== undefined;
    if (!hasDbKey && !hasEnvKey) {
      throw conflict('Save an API key for the selected provider before enabling the copilot.');
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
