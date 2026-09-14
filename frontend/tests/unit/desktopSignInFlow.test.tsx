import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as authClient from '@/api/authClient';
import { useShellSignIn } from '@/shared/auth/useShellSignIn';
import type { Me } from '@/types/models';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

const mockRefresh = vi.fn();
vi.mock('@/context/SessionContext', () => ({
  useSession: () => ({
    refresh: mockRefresh,
    status: 'anonymous',
    user: null,
  }),
}));

const adminUser: Me = {
  id: 'admin-1',
  name: 'Harshid Soni',
  email: 'harshidsoni01@gmail.com',
  emailVerified: true,
  role: 'admin',
  status: 'active',
  phone: null,
  image: null,
  linkedClients: [],
  pinnedClients: [],
  notificationPreferences: {
    emailOnAssignment: true,
    emailDeadlineReminders: true,
    emailDailyDigest: true,
  },
  unlinked: false,
  permissions: {},
};

describe('useShellSignIn desktop navigation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('navigates directly to /dashboard when admin credentials succeed', async () => {
    vi.spyOn(authClient, 'signInWithEmail').mockResolvedValueOnce(undefined);
    mockRefresh.mockResolvedValueOnce({ kind: 'authenticated', user: adminUser });

    const { result } = renderHook(() =>
      useShellSignIn({ restoreDesktopEmail: true, defaultRedirect: '/dashboard' }),
    );

    act(() => {
      result.current.form.setValue('email', 'harshidsoni01@gmail.com');
      result.current.form.setValue('password', 'Harshid@123');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(authClient.signInWithEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'harshidsoni01@gmail.com',
        password: 'Harshid@123',
      }),
    );
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  it('honours defaultRedirect if an intended destination was provided', async () => {
    vi.spyOn(authClient, 'signInWithEmail').mockResolvedValueOnce(undefined);
    mockRefresh.mockResolvedValueOnce({ kind: 'authenticated', user: adminUser });

    const { result } = renderHook(() =>
      useShellSignIn({ restoreDesktopEmail: true, defaultRedirect: '/clients' }),
    );

    act(() => {
      result.current.form.setValue('email', 'harshidsoni01@gmail.com');
      result.current.form.setValue('password', 'Harshid@123');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/clients', { replace: true });
  });

  it('sets formError and does not navigate when credentials fail', async () => {
    vi.spyOn(authClient, 'signInWithEmail').mockRejectedValueOnce(
      new Error('Invalid practice credentials.'),
    );

    const { result } = renderHook(() =>
      useShellSignIn({ restoreDesktopEmail: true, defaultRedirect: '/dashboard' }),
    );

    act(() => {
      result.current.form.setValue('email', 'harshidsoni01@gmail.com');
      result.current.form.setValue('password', 'WrongPassword');
    });

    await act(async () => {
      await result.current.submit();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(result.current.formError).toContain('Invalid practice credentials.');
  });
});
