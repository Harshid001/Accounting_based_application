import { apiGet, apiPatch } from '@/api/client';
import type { FirmSettings } from '@/types/models';

export const fetchFirmSettings = (): Promise<FirmSettings> =>
  apiGet<FirmSettings>('/settings/firm');

export const updateFirmSettings = (body: unknown): Promise<FirmSettings> =>
  apiPatch<FirmSettings>('/settings/firm', body);
