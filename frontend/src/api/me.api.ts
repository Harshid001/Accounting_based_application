import { apiDelete, apiGet, apiPatch } from '@/api/client';
import { readCurrentAuthUser } from '@/api/authClient';
import { ApiError } from '@/lib/errors';
import type { DeviceSession, Me, NotificationPreferences } from '@/types/models';

export type SessionResult =
  | { kind: 'authenticated'; user: Me }
  | { kind: 'unverified'; email: string; name: string }
  | { kind: 'anonymous' };

export const fetchSession = async (): Promise<SessionResult> => {
  try {
    const user = await apiGet<Me>('/me');
    return { kind: 'authenticated', user };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    const { code } = error.normalised;
    if (code === 'UNAUTHENTICATED') return { kind: 'anonymous' };
    if (code === 'EMAIL_UNVERIFIED') {
      const authUser = await readCurrentAuthUser();
      if (authUser === null) return { kind: 'anonymous' };
      return { kind: 'unverified', email: authUser.email, name: authUser.name };
    }
    throw error;
  }
};

export interface UpdateProfileInput {
  name?: string;
  phone?: string | null;
  notificationPreferences?: Partial<NotificationPreferences>;
}

export const updateProfile = (input: UpdateProfileInput): Promise<Me> =>
  apiPatch<Me>('/me', input);

export const listMySessions = (): Promise<DeviceSession[]> => apiGet<DeviceSession[]>('/me/sessions');

export const revokeOtherSessions = (): Promise<void> => apiDelete<void>('/me/sessions');
