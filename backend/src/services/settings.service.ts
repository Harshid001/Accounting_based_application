import { env } from '../config/env.js';
import type { AddressAttributes } from '../models/client.model.js';
import type { FirmSettingsAttributes } from '../models/firmSettings.model.js';
import { FIRM_SETTINGS_ID, FirmSettings } from '../models/firmSettings.model.js';
import type { RequestActor } from '../types/context.js';
import { buildDiff, recordAudit } from './audit.service.js';

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
  const existing = await FirmSettings.findById(FIRM_SETTINGS_ID).lean().exec();
  if (existing) return existing;
  const created = await FirmSettings.create({
    _id: FIRM_SETTINGS_ID,
    firmName: 'Your accounting practice',
    complianceHorizonDays: env.COMPLIANCE_HORIZON_DAYS,
  });
  return created.toObject();
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

export const updateFirmSettings = async (
  update: FirmSettingsUpdate,
  actor: RequestActor,
): Promise<FirmSettingsAttributes> => {
  const before = await getFirmSettings();
  const doc = await FirmSettings.findById(FIRM_SETTINGS_ID).exec();
  if (!doc) throw new Error('Firm settings document vanished after being created.');

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
  return after;
};
