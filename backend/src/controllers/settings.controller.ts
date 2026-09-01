import type { z } from 'zod';

import { sendData } from '../lib/http.js';
import type { RouteContext } from '../middleware/validate.js';
import { getFirmSettings, updateFirmSettings } from '../services/settings.service.js';
import type { firmSettingsBody } from '../validators/report.validators.js';

type SettingsBody = z.infer<typeof firmSettingsBody>;

const publicView = (settings: Awaited<ReturnType<typeof getFirmSettings>>) => ({
  firmName: settings.firmName,
  address: settings.address ?? null,
  contactEmail: settings.contactEmail ?? null,
  contactPhone: settings.contactPhone ?? null,
  logoStorageKey: settings.logoStorageKey ?? null,
  financialYearStartMonth: settings.financialYearStartMonth,
});

const adminView = (settings: Awaited<ReturnType<typeof getFirmSettings>>) => ({
  ...publicView(settings),
  defaultReminderOffsetsDays: settings.defaultReminderOffsetsDays,
  complianceHorizonDays: settings.complianceHorizonDays,
});

export const read = async (_input: unknown, ctx: RouteContext): Promise<void> => {
  const settings = await getFirmSettings();
  sendData(ctx.res, ctx.user.role === 'admin' ? adminView(settings) : publicView(settings));
};

export const update = async (
  input: { body: SettingsBody },
  ctx: RouteContext,
): Promise<void> => {
  const settings = await updateFirmSettings(input.body, ctx.actor);
  sendData(ctx.res, adminView(settings));
};
