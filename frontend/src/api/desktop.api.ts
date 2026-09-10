/**
 * Desktop coordination API (spec §7): workstation registry, the auth'd
 * command poll, and the shell version manifest. All endpoints are
 * capability-gated server-side; this module only carries the wire calls.
 */
import { apiGet, apiList, apiDelete } from '@/api/client';
import type { Paged } from '@/types/api';

export interface WorkstationView {
  id: string;
  user: string | null;
  userName: string | null;
  deviceId: string;
  deviceName: string;
  platform: string | null;
  appVersion: string | null;
  lastSeenAt: string;
  online: boolean;
  tally: {
    reachable: boolean;
    companyName: string | null;
    educationMode: boolean;
    checkedAt: string | null;
  };
  revoked: boolean;
}

export interface DesktopManifest {
  minShellVersion: string;
  latestShellVersion: string;
  updateUrl: string;
}

export const listWorkstations = (params: {
  q?: string;
  page: number;
  limit: number;
}): Promise<Paged<WorkstationView>> =>
  apiList<WorkstationView>('/desktop/workstations', {
    method: 'GET',
    query: {
      page: params.page,
      limit: params.limit,
      ...(params.q === undefined ? {} : { q: params.q }),
    },
  });

export const revokeWorkstation = (id: string): Promise<void> =>
  apiDelete<void>(`/desktop/workstations/${id}`);

/** Public: read before sign-in so an outdated shell gets the update gate. */
export const fetchDesktopManifest = (): Promise<DesktopManifest> =>
  apiGet<DesktopManifest>('/desktop/manifest');
