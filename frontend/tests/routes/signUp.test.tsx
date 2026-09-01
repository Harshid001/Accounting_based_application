import { QueryClientProvider } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/app/ProtectedRoute';
import { RoleGate } from '@/app/RoleGate';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { makeQueryClient } from '../helpers/render';
import { makeMe, permissionsFor, stubFetch } from '../helpers/server';
import type { StubRoute } from '../helpers/server';

function Shell({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={makeQueryClient()}>
      <ThemeProvider>
        <ToastProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const renderGuarded = (routes: readonly StubRoute[], entry = '/dashboard') => {
  stubFetch(routes);
  return render(
    <Shell>
      <MemoryRouter initialEntries={[entry]}>
        <SessionProvider>
          <Routes>
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RoleGate roles={['admin', 'staff']} fallback="home">
                    <h1>Dashboard</h1>
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/users"
              element={
                <ProtectedRoute>
                  <RoleGate roles={['admin']}>
                    <h1>Users</h1>
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/portal"
              element={
                <ProtectedRoute>
                  <RoleGate roles={['client']} fallback="home">
                    <h1>Portal</h1>
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route path="/sign-in" element={<h1>Sign in</h1>} />
            <Route path="/unlinked" element={<h1>Your firm has been notified</h1>} />
            <Route path="/verify-email" element={<h1>Verify your email</h1>} />
            <Route path="/403" element={<h1>You do not have access to that</h1>} />
          </Routes>
        </SessionProvider>
      </MemoryRouter>
    </Shell>,
  );
};

afterEach(() => {
  window.localStorage.clear();
});

describe('a freshly signed-up account', () => {
  it('lands on the unlinked screen, not the app, when it has no linked clients', async () => {
    renderGuarded(
      [
        {
          match: '/me',
          data: makeMe({
            role: 'client',
            linkedClients: [],
            unlinked: true,
            permissions: permissionsFor('client'),
          }),
        },
      ],
      '/portal',
    );

    expect(await screen.findByRole('heading', { name: 'Your firm has been notified' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Portal' })).not.toBeInTheDocument();
  });

  it('reaches the portal once the firm links a client record', async () => {
    renderGuarded(
      [
        {
          match: '/me',
          data: makeMe({
            role: 'client',
            linkedClients: ['client-1'],
            unlinked: false,
            permissions: permissionsFor('client'),
          }),
        },
      ],
      '/portal',
    );

    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
  });
});

describe('the verification gate', () => {
  it('sends an unverified account to verify-email rather than a blank screen', async () => {
    renderGuarded([
      { match: '/api/auth/get-session', data: null },
      { match: '/me', errorCode: 'EMAIL_UNVERIFIED', status: 403 },
    ]);

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', { name: 'Verify your email' }) ??
          screen.queryByRole('heading', { name: 'Sign in' }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('sends an anonymous visitor to sign in', async () => {
    renderGuarded([{ match: '/me', errorCode: 'UNAUTHENTICATED', status: 401 }]);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('workspace boundaries', () => {
  it('redirects a staff account away from an admin-only screen to 403', async () => {
    renderGuarded(
      [{ match: '/me', data: makeMe({ role: 'staff', permissions: permissionsFor('staff') }) }],
      '/settings/users',
    );

    expect(
      await screen.findByRole('heading', { name: 'You do not have access to that' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('redirects a client account away from the staff dashboard', async () => {
    renderGuarded(
      [
        {
          match: '/me',
          data: makeMe({
            role: 'client',
            linkedClients: ['client-1'],
            unlinked: false,
            permissions: permissionsFor('client'),
          }),
        },
      ],
      '/dashboard',
    );

    expect(await screen.findByRole('heading', { name: 'Portal' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('redirects an admin away from the client portal', async () => {
    renderGuarded(
      [{ match: '/me', data: makeMe({ role: 'admin', permissions: permissionsFor('admin') }) }],
      '/portal',
    );

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Portal' })).not.toBeInTheDocument();
  });

  it('lets an admin through to an admin-only screen', async () => {
    renderGuarded(
      [{ match: '/me', data: makeMe({ role: 'admin', permissions: permissionsFor('admin') }) }],
      '/settings/users',
    );

    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });
});
